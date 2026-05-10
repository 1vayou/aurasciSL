import { AnchorProvider, BN, Program } from '@coral-xyz/anchor';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { AuraSciIDL, AuraSci } from '../program/aurasci_program';
import { AURASCI_PROGRAM_ID, USDC_MINT } from './connection';
import {
  intentPda,
  milestonePda,
  patronagePda,
  escrowVaultPda,
  scientistPda,
} from './pdas';

/**
 * Returns a typed Anchor Program client. The wallet from the provider
 * is used to sign transactions.
 */
export function getProgram(provider: AnchorProvider): Program<AuraSci> {
  return new Program<AuraSci>(AuraSciIDL as any, AURASCI_PROGRAM_ID, provider);
}

// ──────────────────────────────────────────────────────────────────────
// HIGH-LEVEL TX BUILDERS
// ──────────────────────────────────────────────────────────────────────

/**
 * Patronage tx — patron sends USDC into the program-owned escrow vault for
 * an intent. The program records the patronage in a Patronage PDA and mints
 * a "Patron Receipt" NFT to the patron.
 */
export async function buildPatronageTx(params: {
  program: Program<AuraSci>;
  patron: PublicKey;
  scientist: PublicKey;
  intentId: bigint;
  amountUsdc: number; // in dollars, e.g. 250
}): Promise<Transaction> {
  const { program, patron, scientist, intentId, amountUsdc } = params;
  const [intent] = intentPda(scientist, intentId);
  const [vault] = escrowVaultPda(intent);
  const [patronage] = patronagePda(intent, patron);
  const patronUsdcAta = await getAssociatedTokenAddress(USDC_MINT, patron);

  const amount = new BN(Math.round(amountUsdc * 1_000_000)); // 6-decimals USDC

  const ix = await program.methods
    .patronize(amount)
    .accounts({
      patron,
      intent,
      patronage,
      vault,
      patronUsdcAta,
      usdcMint: USDC_MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();

  return new Transaction().add(ix);
}

/**
 * Scientist submits a hash of off-chain proof (e.g. IPFS CID of a paper /
 * dataset / commit log) for a milestone. This locks the milestone for AI
 * verification — funds are NOT released yet.
 */
export async function buildSubmitProofTx(params: {
  program: Program<AuraSci>;
  scientist: PublicKey;
  intentId: bigint;
  milestoneIndex: 0 | 1 | 2;
  proofUri: string; // ipfs://… or ar://…
  proofHash: Uint8Array; // 32-byte SHA-256 of the document
}): Promise<Transaction> {
  const { program, scientist, intentId, milestoneIndex, proofUri, proofHash } =
    params;
  const [intent] = intentPda(scientist, intentId);
  const [milestone] = milestonePda(intent, milestoneIndex);

  if (proofHash.length !== 32) {
    throw new Error('proofHash must be 32 bytes (SHA-256)');
  }

  const ix = await program.methods
    .submitProof(milestoneIndex, proofUri, Array.from(proofHash))
    .accounts({
      scientist,
      intent,
      milestone,
    })
    .instruction();

  return new Transaction().add(ix);
}

/**
 * Called by the AI verifier (a server-side keypair authorised by the
 * program). Marks a milestone as verified and releases its USDC tranche
 * from escrow to the scientist's USDC ATA. Also mints a "Milestone NFT"
 * to the scientist as a permanent on-chain record.
 */
export async function buildVerifyMilestoneTx(params: {
  program: Program<AuraSci>;
  aiVerifier: PublicKey;
  scientist: PublicKey;
  intentId: bigint;
  milestoneIndex: 0 | 1 | 2;
  aiScore: number; // 0..100
}): Promise<Transaction> {
  const { program, aiVerifier, scientist, intentId, milestoneIndex, aiScore } =
    params;
  const [intent] = intentPda(scientist, intentId);
  const [milestone] = milestonePda(intent, milestoneIndex);
  const [vault] = escrowVaultPda(intent);
  const scientistUsdcAta = await getAssociatedTokenAddress(USDC_MINT, scientist);

  const ix = await program.methods
    .verifyMilestone(milestoneIndex, aiScore)
    .accounts({
      aiVerifier,
      intent,
      milestone,
      vault,
      scientistUsdcAta,
      scientist,
      usdcMint: USDC_MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return new Transaction().add(ix);
}

/**
 * One-shot tx that creates an Intent on-chain along with its 3 milestones
 * and the escrow vault. Called by the scientist after AI Gatekeeper
 * approves the intent off-chain.
 */
export async function buildPublishIntentTx(params: {
  program: Program<AuraSci>;
  scientist: PublicKey;
  intentId: bigint;
  ticker: string; // e.g. "$CELL-01"
  metadataUri: string; // ipfs://… JSON with title/abstract/tags
  fundingGoalUsdc: number; // in dollars
  milestoneAmounts: [number, number, number]; // must sum to fundingGoalUsdc
  aiScore: number; // 0..100, set by Gatekeeper
}): Promise<Transaction> {
  const {
    program,
    scientist,
    intentId,
    ticker,
    metadataUri,
    fundingGoalUsdc,
    milestoneAmounts,
    aiScore,
  } = params;

  const [scientistAccount] = scientistPda(scientist);
  const [intent] = intentPda(scientist, intentId);
  const [m0] = milestonePda(intent, 0);
  const [m1] = milestonePda(intent, 1);
  const [m2] = milestonePda(intent, 2);
  const [vault] = escrowVaultPda(intent);

  const goal = new BN(Math.round(fundingGoalUsdc * 1_000_000));
  const tranches = milestoneAmounts.map(
    (m) => new BN(Math.round(m * 1_000_000))
  ) as [BN, BN, BN];

  const ix = await program.methods
    .publishIntent(
      new BN(intentId.toString()),
      ticker,
      metadataUri,
      goal,
      tranches,
      aiScore
    )
    .accounts({
      scientist,
      scientistAccount,
      intent,
      milestone0: m0,
      milestone1: m1,
      milestone2: m2,
      vault,
      usdcMint: USDC_MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();

  return new Transaction().add(ix);
}
