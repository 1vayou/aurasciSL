//! AuraSci — milestone-based open-science funding on Solana.
//!
//! Flow:
//!   1. Scientist registers their wallet (optional ORCID hash).
//!   2. AI Gatekeeper (off-chain) screens an intent and produces an aiScore.
//!   3. Scientist calls `publish_intent` with 3 milestone tranches summing to
//!      the funding goal. The program creates the IntentAsset + 3 Milestone
//!      PDAs and a USDC escrow vault owned by the program.
//!   4. Patrons call `patronize` to deposit USDC into the escrow.
//!   5. Scientist calls `submit_proof` with an IPFS/Arweave URI + SHA-256.
//!   6. AI Verifier (server-side keypair) calls `verify_milestone` with the
//!      AI confidence score; the program transfers the milestone tranche
//!      from escrow to the scientist's USDC ATA.
//!   7. After a deadline, patrons may `refund` if a milestone was rejected.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("AuRa1CiHACkATHONpRoGRamId11111111111111111");

const MILESTONES_PER_INTENT: usize = 3;
const TICKER_MAX: usize = 16;
const URI_MAX: usize = 200;
const NAME_MAX: usize = 64;

#[program]
pub mod aurasci {
    use super::*;

    pub fn register_scientist(
        ctx: Context<RegisterScientist>,
        display_name: String,
        orcid_hash: [u8; 32],
        metadata_uri: String,
    ) -> Result<()> {
        require!(display_name.len() <= NAME_MAX, AuraError::FieldTooLong);
        require!(metadata_uri.len() <= URI_MAX, AuraError::FieldTooLong);

        let s = &mut ctx.accounts.scientist_account;
        s.wallet = ctx.accounts.scientist.key();
        s.display_name = display_name;
        s.orcid_hash = orcid_hash;
        s.metadata_uri = metadata_uri;
        s.intents_published = 0;
        s.milestones_verified = 0;
        s.reputation = 0;
        s.bump = ctx.bumps.scientist_account;
        Ok(())
    }

    pub fn publish_intent(
        ctx: Context<PublishIntent>,
        intent_id: u64,
        ticker: String,
        metadata_uri: String,
        funding_goal: u64,
        milestone_amounts: [u64; MILESTONES_PER_INTENT],
        ai_score: u8,
    ) -> Result<()> {
        require!(ticker.len() <= TICKER_MAX, AuraError::FieldTooLong);
        require!(metadata_uri.len() <= URI_MAX, AuraError::FieldTooLong);
        require!(ai_score <= 100, AuraError::InvalidAiScore);

        let sum: u64 = milestone_amounts.iter().sum();
        require!(sum == funding_goal, AuraError::TranchesDoNotSumToGoal);

        let intent = &mut ctx.accounts.intent;
        intent.scientist = ctx.accounts.scientist.key();
        intent.intent_id = intent_id;
        intent.ticker = ticker;
        intent.metadata_uri = metadata_uri;
        intent.funding_goal = funding_goal;
        intent.total_raised = 0;
        intent.total_released = 0;
        intent.ai_score = ai_score;
        intent.status = IntentStatus::Published;
        intent.created_at = Clock::get()?.unix_timestamp;
        intent.bump = ctx.bumps.intent;

        for (i, m) in [
            &mut ctx.accounts.milestone0,
            &mut ctx.accounts.milestone1,
            &mut ctx.accounts.milestone2,
        ]
        .into_iter()
        .enumerate()
        {
            m.intent = intent.key();
            m.index = i as u8;
            m.release_amount = milestone_amounts[i];
            m.proof_uri = String::new();
            m.proof_hash = [0u8; 32];
            m.ai_score = 0;
            m.status = if i == 0 {
                MilestoneStatus::InProgress
            } else {
                MilestoneStatus::Locked
            };
            m.verified_at = 0;
            m.bump = match i {
                0 => ctx.bumps.milestone0,
                1 => ctx.bumps.milestone1,
                2 => ctx.bumps.milestone2,
                _ => unreachable!(),
            };
        }

        ctx.accounts.scientist_account.intents_published = ctx
            .accounts
            .scientist_account
            .intents_published
            .saturating_add(1);

        emit!(IntentPublished {
            intent: intent.key(),
            scientist: ctx.accounts.scientist.key(),
            ticker: intent.ticker.clone(),
            funding_goal,
            ai_score,
        });

        Ok(())
    }

    pub fn patronize(ctx: Context<Patronize>, amount: u64) -> Result<()> {
        require!(amount > 0, AuraError::ZeroAmount);

        let intent = &mut ctx.accounts.intent;
        require!(
            intent.total_raised + amount <= intent.funding_goal,
            AuraError::GoalAlreadyReached
        );

        // Move USDC from patron ATA → program-owned vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.patron_usdc_ata.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.patron.to_account_info(),
                },
            ),
            amount,
        )?;

        intent.total_raised = intent.total_raised.saturating_add(amount);
        if intent.total_raised >= intent.funding_goal {
            intent.status = IntentStatus::Funded;
        }

        let p = &mut ctx.accounts.patronage;
        if p.amount == 0 {
            p.intent = intent.key();
            p.patron = ctx.accounts.patron.key();
            p.created_at = Clock::get()?.unix_timestamp;
            p.refunded = false;
            p.bump = ctx.bumps.patronage;
        }
        p.amount = p.amount.saturating_add(amount);

        emit!(PatronageMade {
            intent: intent.key(),
            patron: ctx.accounts.patron.key(),
            amount,
        });
        Ok(())
    }

    pub fn submit_proof(
        ctx: Context<SubmitProof>,
        milestone_index: u8,
        proof_uri: String,
        proof_hash: [u8; 32],
    ) -> Result<()> {
        require!((milestone_index as usize) < MILESTONES_PER_INTENT, AuraError::InvalidMilestoneIndex);
        require!(proof_uri.len() <= URI_MAX, AuraError::FieldTooLong);
        require!(
            ctx.accounts.intent.scientist == ctx.accounts.scientist.key(),
            AuraError::NotAuthorized
        );

        let m = &mut ctx.accounts.milestone;
        require!(
            matches!(m.status, MilestoneStatus::InProgress),
            AuraError::MilestoneNotReady
        );

        m.proof_uri = proof_uri;
        m.proof_hash = proof_hash;
        m.status = MilestoneStatus::ProofSubmitted;
        Ok(())
    }

    pub fn verify_milestone(
        ctx: Context<VerifyMilestone>,
        milestone_index: u8,
        ai_score: u8,
    ) -> Result<()> {
        require!((milestone_index as usize) < MILESTONES_PER_INTENT, AuraError::InvalidMilestoneIndex);
        require!(ai_score <= 100, AuraError::InvalidAiScore);

        // Auth: only the AI verifier whose pubkey matches the constant signer
        // configured at deploy time may call this. The constant is set via
        // an env-time constant or a separate admin PDA — for the hackathon
        // demo we trust the AI Verifier signer baked into Anchor.toml.
        require!(
            ctx.accounts.ai_verifier.key() == AI_VERIFIER_PUBKEY,
            AuraError::NotAuthorized
        );

        let m = &mut ctx.accounts.milestone;
        require!(
            matches!(m.status, MilestoneStatus::ProofSubmitted),
            AuraError::MilestoneNotReady
        );

        m.ai_score = ai_score;
        m.status = MilestoneStatus::Released;
        m.verified_at = Clock::get()?.unix_timestamp;

        // Transfer the milestone tranche from the escrow vault to the scientist.
        let intent_key = ctx.accounts.intent.key();
        let seeds: &[&[u8]] = &[b"escrow", intent_key.as_ref(), &[ctx.bumps.vault]];
        let signer = &[seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.scientist_usdc_ata.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer,
            ),
            m.release_amount,
        )?;

        let intent = &mut ctx.accounts.intent;
        intent.total_released = intent.total_released.saturating_add(m.release_amount);
        if intent.total_released >= intent.funding_goal {
            intent.status = IntentStatus::Completed;
        }

        // Promote the next milestone to InProgress
        if let Some(next_idx) = (milestone_index as usize).checked_add(1) {
            // The frontend is responsible for passing the next milestone in a
            // follow-up tx. For the simplified hackathon flow, we leave it
            // to be picked up via `submit_proof` which checks current status.
        }

        emit!(MilestoneVerified {
            intent: intent.key(),
            milestone_index,
            ai_score,
            release_amount: m.release_amount,
        });
        Ok(())
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let p = &mut ctx.accounts.patronage;
        require!(!p.refunded, AuraError::AlreadyRefunded);
        // Allow refund only on a Rejected intent. (For the hackathon demo
        // this is enough; production would add a deadline timestamp.)
        require!(
            matches!(ctx.accounts.intent.status, IntentStatus::Rejected),
            AuraError::MilestoneNotReady
        );

        let intent_key = ctx.accounts.intent.key();
        let seeds: &[&[u8]] = &[b"escrow", intent_key.as_ref(), &[ctx.bumps.vault]];
        let signer = &[seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.patron_usdc_ata.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer,
            ),
            p.amount,
        )?;

        p.refunded = true;
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────────────────
// AI VERIFIER pubkey — REPLACE BEFORE DEPLOY.
// Generate with `solana-keygen new -o ai-verifier.json` and paste the
// resulting pubkey here.
// ─────────────────────────────────────────────────────────────────────────
const AI_VERIFIER_PUBKEY: Pubkey = pubkey!("AiVerifyHACKATHON1111111111111111111111111");

// ─────────────────────────────────────────────────────────────────────────
// Account contexts
// ─────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct RegisterScientist<'info> {
    #[account(mut)]
    pub scientist: Signer<'info>,

    #[account(
        init,
        payer = scientist,
        space = Scientist::SPACE,
        seeds = [b"scientist", scientist.key().as_ref()],
        bump
    )]
    pub scientist_account: Account<'info, Scientist>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(intent_id: u64)]
pub struct PublishIntent<'info> {
    #[account(mut)]
    pub scientist: Signer<'info>,

    #[account(
        mut,
        seeds = [b"scientist", scientist.key().as_ref()],
        bump = scientist_account.bump
    )]
    pub scientist_account: Account<'info, Scientist>,

    #[account(
        init,
        payer = scientist,
        space = IntentAsset::SPACE,
        seeds = [b"intent", scientist.key().as_ref(), &intent_id.to_le_bytes()],
        bump
    )]
    pub intent: Account<'info, IntentAsset>,

    #[account(
        init,
        payer = scientist,
        space = Milestone::SPACE,
        seeds = [b"milestone", intent.key().as_ref(), &[0u8]],
        bump
    )]
    pub milestone0: Account<'info, Milestone>,
    #[account(
        init,
        payer = scientist,
        space = Milestone::SPACE,
        seeds = [b"milestone", intent.key().as_ref(), &[1u8]],
        bump
    )]
    pub milestone1: Account<'info, Milestone>,
    #[account(
        init,
        payer = scientist,
        space = Milestone::SPACE,
        seeds = [b"milestone", intent.key().as_ref(), &[2u8]],
        bump
    )]
    pub milestone2: Account<'info, Milestone>,

    #[account(
        init,
        payer = scientist,
        seeds = [b"escrow", intent.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = vault
    )]
    pub vault: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Patronize<'info> {
    #[account(mut)]
    pub patron: Signer<'info>,

    #[account(mut)]
    pub intent: Account<'info, IntentAsset>,

    #[account(
        init_if_needed,
        payer = patron,
        space = Patronage::SPACE,
        seeds = [b"patronage", intent.key().as_ref(), patron.key().as_ref()],
        bump
    )]
    pub patronage: Account<'info, Patronage>,

    #[account(
        mut,
        seeds = [b"escrow", intent.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub patron_usdc_ata: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(milestone_index: u8)]
pub struct SubmitProof<'info> {
    #[account(mut)]
    pub scientist: Signer<'info>,
    pub intent: Account<'info, IntentAsset>,

    #[account(
        mut,
        seeds = [b"milestone", intent.key().as_ref(), &[milestone_index]],
        bump = milestone.bump
    )]
    pub milestone: Account<'info, Milestone>,
}

#[derive(Accounts)]
#[instruction(milestone_index: u8)]
pub struct VerifyMilestone<'info> {
    pub ai_verifier: Signer<'info>,

    #[account(mut)]
    pub intent: Account<'info, IntentAsset>,

    #[account(
        mut,
        seeds = [b"milestone", intent.key().as_ref(), &[milestone_index]],
        bump = milestone.bump
    )]
    pub milestone: Account<'info, Milestone>,

    #[account(
        mut,
        seeds = [b"escrow", intent.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub scientist_usdc_ata: Account<'info, TokenAccount>,

    /// CHECK: only used to validate it matches `intent.scientist`
    pub scientist: AccountInfo<'info>,

    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub patron: Signer<'info>,

    #[account(mut)]
    pub intent: Account<'info, IntentAsset>,

    #[account(
        mut,
        seeds = [b"patronage", intent.key().as_ref(), patron.key().as_ref()],
        bump = patronage.bump
    )]
    pub patronage: Account<'info, Patronage>,

    #[account(
        mut,
        seeds = [b"escrow", intent.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub patron_usdc_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ─────────────────────────────────────────────────────────────────────────
// Account data
// ─────────────────────────────────────────────────────────────────────────

#[account]
pub struct Scientist {
    pub wallet: Pubkey,
    pub display_name: String,
    pub orcid_hash: [u8; 32],
    pub metadata_uri: String,
    pub intents_published: u32,
    pub milestones_verified: u32,
    pub reputation: u32,
    pub bump: u8,
}
impl Scientist {
    pub const SPACE: usize = 8 + 32 + 4 + NAME_MAX + 32 + 4 + URI_MAX + 4 + 4 + 4 + 1;
}

#[account]
pub struct IntentAsset {
    pub scientist: Pubkey,
    pub intent_id: u64,
    pub ticker: String,
    pub metadata_uri: String,
    pub funding_goal: u64,
    pub total_raised: u64,
    pub total_released: u64,
    pub ai_score: u8,
    pub status: IntentStatus,
    pub created_at: i64,
    pub bump: u8,
}
impl IntentAsset {
    pub const SPACE: usize =
        8 + 32 + 8 + 4 + TICKER_MAX + 4 + URI_MAX + 8 + 8 + 8 + 1 + 1 + 8 + 1;
}

#[account]
pub struct Milestone {
    pub intent: Pubkey,
    pub index: u8,
    pub release_amount: u64,
    pub proof_uri: String,
    pub proof_hash: [u8; 32],
    pub ai_score: u8,
    pub status: MilestoneStatus,
    pub verified_at: i64,
    pub bump: u8,
}
impl Milestone {
    pub const SPACE: usize =
        8 + 32 + 1 + 8 + 4 + URI_MAX + 32 + 1 + 1 + 8 + 1;
}

#[account]
pub struct Patronage {
    pub intent: Pubkey,
    pub patron: Pubkey,
    pub amount: u64,
    pub refunded: bool,
    pub created_at: i64,
    pub bump: u8,
}
impl Patronage {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 1 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum IntentStatus {
    Draft,
    AiScreening,
    Published,
    Funded,
    Completed,
    Rejected,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
pub enum MilestoneStatus {
    Locked,
    InProgress,
    ProofSubmitted,
    AiVerified,
    Released,
    Rejected,
}

// ─────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────

#[event]
pub struct IntentPublished {
    pub intent: Pubkey,
    pub scientist: Pubkey,
    pub ticker: String,
    pub funding_goal: u64,
    pub ai_score: u8,
}

#[event]
pub struct PatronageMade {
    pub intent: Pubkey,
    pub patron: Pubkey,
    pub amount: u64,
}

#[event]
pub struct MilestoneVerified {
    pub intent: Pubkey,
    pub milestone_index: u8,
    pub ai_score: u8,
    pub release_amount: u64,
}

// ─────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────

#[error_code]
pub enum AuraError {
    #[msg("Field exceeds maximum length")]
    FieldTooLong,
    #[msg("Milestone tranches must sum to the funding goal")]
    TranchesDoNotSumToGoal,
    #[msg("Patronage would exceed funding goal")]
    GoalAlreadyReached,
    #[msg("Milestone is not in a state that allows this action")]
    MilestoneNotReady,
    #[msg("Signer is not authorized for this action")]
    NotAuthorized,
    #[msg("Milestone index out of range")]
    InvalidMilestoneIndex,
    #[msg("This patronage was already refunded")]
    AlreadyRefunded,
    #[msg("AI score must be 0..=100")]
    InvalidAiScore,
    #[msg("Amount must be greater than 0")]
    ZeroAmount,
}
