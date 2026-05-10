import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

/**
 * Singleton RPC connection. Reads the endpoint from NEXT_PUBLIC_SOLANA_RPC_URL,
 * falling back to the public devnet RPC.
 *
 * For production / mainnet you should plug in a private RPC provider
 * (Helius, Triton, QuickNode) to avoid devnet rate limits.
 */
export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('devnet');

export const connection = new Connection(RPC_URL, 'confirmed');

/**
 * AuraSci Anchor program ID. This MUST match the address printed by
 * `anchor deploy` and copied into Anchor.toml + the Rust program's
 * declare_id! macro.
 */
export const AURASCI_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_AURASCI_PROGRAM_ID ||
    'AuRa1CiHACkATHONpRoGRamId11111111111111111'
);

/**
 * USDC SPL mint. Devnet default is the SPL faucet's USDC-Dev mint.
 * On mainnet replace with EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.
 */
export const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT ||
    '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'
);

/** Helper: shorten a base58 address for display. */
export const shortAddress = (address: string | PublicKey): string => {
  const s = typeof address === 'string' ? address : address.toBase58();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
};
