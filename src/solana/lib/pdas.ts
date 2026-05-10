import { PublicKey } from '@solana/web3.js';
import { AURASCI_PROGRAM_ID } from './connection';

/**
 * Program-Derived Address (PDA) helpers for the AuraSci Anchor program.
 *
 * On-chain account hierarchy:
 *
 *   Scientist     ── ["scientist", scientist_wallet]
 *   IntentAsset   ── ["intent",    scientist_wallet, intent_id_u64_le]
 *   Milestone     ── ["milestone", intent_pda,        milestone_index_u8]
 *   Patronage     ── ["patronage", intent_pda,        patron_wallet]
 *   EscrowVault   ── ["escrow",    intent_pda]   ← USDC ATA owned by program
 */

const enc = (s: string) => Buffer.from(s);

export const scientistPda = (wallet: PublicKey): [PublicKey, number] =>
  PublicKey.findProgramAddressSync(
    [enc('scientist'), wallet.toBuffer()],
    AURASCI_PROGRAM_ID
  );

export const intentPda = (
  scientist: PublicKey,
  intentId: bigint
): [PublicKey, number] => {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(intentId);
  return PublicKey.findProgramAddressSync(
    [enc('intent'), scientist.toBuffer(), idBuf],
    AURASCI_PROGRAM_ID
  );
};

export const milestonePda = (
  intent: PublicKey,
  index: 0 | 1 | 2
): [PublicKey, number] =>
  PublicKey.findProgramAddressSync(
    [enc('milestone'), intent.toBuffer(), Uint8Array.of(index)],
    AURASCI_PROGRAM_ID
  );

export const patronagePda = (
  intent: PublicKey,
  patron: PublicKey
): [PublicKey, number] =>
  PublicKey.findProgramAddressSync(
    [enc('patronage'), intent.toBuffer(), patron.toBuffer()],
    AURASCI_PROGRAM_ID
  );

export const escrowVaultPda = (intent: PublicKey): [PublicKey, number] =>
  PublicKey.findProgramAddressSync(
    [enc('escrow'), intent.toBuffer()],
    AURASCI_PROGRAM_ID
  );
