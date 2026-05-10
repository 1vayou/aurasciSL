import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  getAccount,
} from '@solana/spl-token';
import { USDC_MINT } from './connection';

/** USDC has 6 decimals. */
export const USDC_DECIMALS = 6;

/** Convert a human dollar number into base units (e.g. 12.34 → 12340000). */
export const toUSDCBaseUnits = (amount: number): bigint =>
  BigInt(Math.round(amount * 10 ** USDC_DECIMALS));

/** Convert base units to a human dollar number. */
export const fromUSDCBaseUnits = (units: bigint | number): number =>
  Number(units) / 10 ** USDC_DECIMALS;

/** Get the USDC ATA for a wallet (does not create it). */
export const getUsdcAta = (owner: PublicKey) =>
  getAssociatedTokenAddress(USDC_MINT, owner, true);

/**
 * Returns the USDC balance (in dollars) of a wallet, or 0 if the ATA
 * doesn't exist yet.
 */
export async function getUsdcBalance(
  connection: Connection,
  owner: PublicKey
): Promise<number> {
  const ata = await getUsdcAta(owner);
  try {
    const account = await getAccount(connection, ata);
    return fromUSDCBaseUnits(account.amount);
  } catch {
    return 0;
  }
}

/**
 * Returns an instruction that creates the USDC ATA for `owner`,
 * paid for by `payer`. Returns `null` if the ATA already exists.
 */
export async function ensureUsdcAtaIx(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey
): Promise<{ ata: PublicKey; ix: TransactionInstruction | null }> {
  const ata = await getUsdcAta(owner);
  const info = await connection.getAccountInfo(ata);
  if (info) return { ata, ix: null };
  const ix = createAssociatedTokenAccountInstruction(
    payer,
    ata,
    owner,
    USDC_MINT,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return { ata, ix };
}
