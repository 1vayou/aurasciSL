import type { Idl } from '@coral-xyz/anchor';

/**
 * Anchor IDL for the AuraSci on-chain program.
 *
 * This file is generated alongside `anchor build` and copied here so the
 * frontend can call into the program with full type-safety. The Rust source
 * lives at programs/aurasci/src/lib.rs.
 */
export const AuraSciIDL = {
  version: '0.1.0',
  name: 'aurasci',
  instructions: [
    {
      name: 'registerScientist',
      docs: ['Create a Scientist account, optionally tied to a verified ORCID hash.'],
      accounts: [
        { name: 'scientist', isMut: true, isSigner: true },
        { name: 'scientistAccount', isMut: true, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'displayName', type: 'string' },
        { name: 'orcidHash', type: { array: ['u8', 32] } },
        { name: 'metadataUri', type: 'string' },
      ],
    },
    {
      name: 'publishIntent',
      docs: [
        'Create an IntentAsset with exactly 3 milestones and an escrow vault.',
        'Called after the off-chain AI Gatekeeper has produced an aiScore.',
      ],
      accounts: [
        { name: 'scientist', isMut: true, isSigner: true },
        { name: 'scientistAccount', isMut: true, isSigner: false },
        { name: 'intent', isMut: true, isSigner: false },
        { name: 'milestone0', isMut: true, isSigner: false },
        { name: 'milestone1', isMut: true, isSigner: false },
        { name: 'milestone2', isMut: true, isSigner: false },
        { name: 'vault', isMut: true, isSigner: false },
        { name: 'usdcMint', isMut: false, isSigner: false },
        { name: 'tokenProgram', isMut: false, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
        { name: 'rent', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'intentId', type: 'u64' },
        { name: 'ticker', type: 'string' },
        { name: 'metadataUri', type: 'string' },
        { name: 'fundingGoal', type: 'u64' },
        { name: 'milestoneAmounts', type: { array: ['u64', 3] } },
        { name: 'aiScore', type: 'u8' },
      ],
    },
    {
      name: 'patronize',
      docs: ['Patron deposits USDC into the intent escrow vault.'],
      accounts: [
        { name: 'patron', isMut: true, isSigner: true },
        { name: 'intent', isMut: true, isSigner: false },
        { name: 'patronage', isMut: true, isSigner: false },
        { name: 'vault', isMut: true, isSigner: false },
        { name: 'patronUsdcAta', isMut: true, isSigner: false },
        { name: 'usdcMint', isMut: false, isSigner: false },
        { name: 'tokenProgram', isMut: false, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
        { name: 'rent', isMut: false, isSigner: false },
      ],
      args: [{ name: 'amount', type: 'u64' }],
    },
    {
      name: 'submitProof',
      docs: [
        'Scientist commits a hash of off-chain proof for a milestone.',
        'Funds are NOT released yet — this only opens the milestone for AI review.',
      ],
      accounts: [
        { name: 'scientist', isMut: true, isSigner: true },
        { name: 'intent', isMut: false, isSigner: false },
        { name: 'milestone', isMut: true, isSigner: false },
      ],
      args: [
        { name: 'milestoneIndex', type: 'u8' },
        { name: 'proofUri', type: 'string' },
        { name: 'proofHash', type: { array: ['u8', 32] } },
      ],
    },
    {
      name: 'verifyMilestone',
      docs: [
        'Called by the AI verifier signer. Releases the milestone tranche',
        'from the escrow vault to the scientist and records aiScore on-chain.',
      ],
      accounts: [
        { name: 'aiVerifier', isMut: false, isSigner: true },
        { name: 'intent', isMut: true, isSigner: false },
        { name: 'milestone', isMut: true, isSigner: false },
        { name: 'vault', isMut: true, isSigner: false },
        { name: 'scientistUsdcAta', isMut: true, isSigner: false },
        { name: 'scientist', isMut: false, isSigner: false },
        { name: 'usdcMint', isMut: false, isSigner: false },
        { name: 'tokenProgram', isMut: false, isSigner: false },
      ],
      args: [
        { name: 'milestoneIndex', type: 'u8' },
        { name: 'aiScore', type: 'u8' },
      ],
    },
    {
      name: 'refund',
      docs: [
        'After a configurable deadline, patrons can reclaim their USDC if',
        'a milestone has been rejected by the AI verifier.',
      ],
      accounts: [
        { name: 'patron', isMut: true, isSigner: true },
        { name: 'intent', isMut: true, isSigner: false },
        { name: 'patronage', isMut: true, isSigner: false },
        { name: 'vault', isMut: true, isSigner: false },
        { name: 'patronUsdcAta', isMut: true, isSigner: false },
        { name: 'tokenProgram', isMut: false, isSigner: false },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: 'Scientist',
      type: {
        kind: 'struct',
        fields: [
          { name: 'wallet', type: 'publicKey' },
          { name: 'displayName', type: 'string' },
          { name: 'orcidHash', type: { array: ['u8', 32] } },
          { name: 'metadataUri', type: 'string' },
          { name: 'intentsPublished', type: 'u32' },
          { name: 'milestonesVerified', type: 'u32' },
          { name: 'reputation', type: 'u32' },
          { name: 'bump', type: 'u8' },
        ],
      },
    },
    {
      name: 'IntentAsset',
      type: {
        kind: 'struct',
        fields: [
          { name: 'scientist', type: 'publicKey' },
          { name: 'intentId', type: 'u64' },
          { name: 'ticker', type: 'string' },
          { name: 'metadataUri', type: 'string' },
          { name: 'fundingGoal', type: 'u64' },
          { name: 'totalRaised', type: 'u64' },
          { name: 'totalReleased', type: 'u64' },
          { name: 'aiScore', type: 'u8' },
          { name: 'status', type: { defined: 'IntentStatus' } },
          { name: 'createdAt', type: 'i64' },
          { name: 'bump', type: 'u8' },
        ],
      },
    },
    {
      name: 'Milestone',
      type: {
        kind: 'struct',
        fields: [
          { name: 'intent', type: 'publicKey' },
          { name: 'index', type: 'u8' },
          { name: 'releaseAmount', type: 'u64' },
          { name: 'proofUri', type: 'string' },
          { name: 'proofHash', type: { array: ['u8', 32] } },
          { name: 'aiScore', type: 'u8' },
          { name: 'status', type: { defined: 'MilestoneStatus' } },
          { name: 'verifiedAt', type: 'i64' },
          { name: 'bump', type: 'u8' },
        ],
      },
    },
    {
      name: 'Patronage',
      type: {
        kind: 'struct',
        fields: [
          { name: 'intent', type: 'publicKey' },
          { name: 'patron', type: 'publicKey' },
          { name: 'amount', type: 'u64' },
          { name: 'refunded', type: 'bool' },
          { name: 'createdAt', type: 'i64' },
          { name: 'bump', type: 'u8' },
        ],
      },
    },
  ],
  types: [
    {
      name: 'IntentStatus',
      type: {
        kind: 'enum',
        variants: [
          { name: 'Draft' },
          { name: 'AiScreening' },
          { name: 'Published' },
          { name: 'Funded' },
          { name: 'Completed' },
          { name: 'Rejected' },
        ],
      },
    },
    {
      name: 'MilestoneStatus',
      type: {
        kind: 'enum',
        variants: [
          { name: 'Locked' },
          { name: 'InProgress' },
          { name: 'ProofSubmitted' },
          { name: 'AiVerified' },
          { name: 'Released' },
          { name: 'Rejected' },
        ],
      },
    },
  ],
  events: [
    {
      name: 'IntentPublished',
      fields: [
        { name: 'intent', type: 'publicKey', index: false },
        { name: 'scientist', type: 'publicKey', index: false },
        { name: 'ticker', type: 'string', index: false },
        { name: 'fundingGoal', type: 'u64', index: false },
        { name: 'aiScore', type: 'u8', index: false },
      ],
    },
    {
      name: 'PatronageMade',
      fields: [
        { name: 'intent', type: 'publicKey', index: false },
        { name: 'patron', type: 'publicKey', index: false },
        { name: 'amount', type: 'u64', index: false },
      ],
    },
    {
      name: 'MilestoneVerified',
      fields: [
        { name: 'intent', type: 'publicKey', index: false },
        { name: 'milestoneIndex', type: 'u8', index: false },
        { name: 'aiScore', type: 'u8', index: false },
        { name: 'releaseAmount', type: 'u64', index: false },
      ],
    },
  ],
  errors: [
    { code: 6000, name: 'TranchesDoNotSumToGoal', msg: 'Milestone tranches must sum to the funding goal' },
    { code: 6001, name: 'GoalAlreadyReached', msg: 'Patronage would exceed funding goal' },
    { code: 6002, name: 'MilestoneNotReady', msg: 'Milestone is not in a state that allows this action' },
    { code: 6003, name: 'NotAuthorized', msg: 'Signer is not authorized for this action' },
    { code: 6004, name: 'InvalidMilestoneIndex', msg: 'Milestone index out of range' },
    { code: 6005, name: 'AlreadyRefunded', msg: 'This patronage was already refunded' },
  ],
} as const;

export type AuraSci = typeof AuraSciIDL;
