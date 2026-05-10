'use client';

import { useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useAnchorProgram } from './useAnchorProgram';
import { buildPatronageTx } from '../lib/escrow';
import { ensureUsdcAtaIx, getUsdcBalance } from '../lib/usdc';

export interface PatronageResult {
  signature: string;
  /** Solana Explorer URL for the tx (devnet by default). */
  explorerUrl: string;
}

export interface UsePatronage {
  patronize: (params: {
    scientist: PublicKey;
    intentId: bigint;
    amountUsdc: number;
  }) => Promise<PatronageResult>;
  isPending: boolean;
  error: string | null;
  signature: string | null;
}

/**
 * usePatronage — hook that wraps the patronage flow:
 *   1. ensure the patron has a USDC ATA (creates one if missing)
 *   2. build the Anchor `patronize` instruction
 *   3. sign + send + confirm the tx
 *
 * Used by the Patron flow on /intent/[id] and the Patron Dashboard.
 */
export function usePatronage(): UsePatronage {
  const { connection } = useConnection();
  const wallet = useWallet();
  const program = useAnchorProgram();

  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const patronize = useCallback(
    async ({
      scientist,
      intentId,
      amountUsdc,
    }: {
      scientist: PublicKey;
      intentId: bigint;
      amountUsdc: number;
    }): Promise<PatronageResult> => {
      if (!program || !wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
      }

      setPending(true);
      setError(null);
      setSignature(null);

      try {
        // Pre-flight: make sure the patron actually has enough USDC
        const balance = await getUsdcBalance(connection, wallet.publicKey);
        if (balance < amountUsdc) {
          throw new Error(
            `Insufficient USDC. Have $${balance.toFixed(2)}, need $${amountUsdc.toFixed(2)}.`
          );
        }

        // 1) ATA bootstrap (no-op if already exists)
        const { ix: ataIx } = await ensureUsdcAtaIx(
          connection,
          wallet.publicKey,
          wallet.publicKey
        );

        // 2) Patronage tx
        const tx = await buildPatronageTx({
          program,
          patron: wallet.publicKey,
          scientist,
          intentId,
          amountUsdc,
        });
        if (ataIx) tx.instructions.unshift(ataIx);

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = wallet.publicKey;

        const signed = await wallet.signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });
        await connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          'confirmed'
        );

        setSignature(sig);
        const cluster = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
        return {
          signature: sig,
          explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=${cluster}`,
        };
      } catch (e: any) {
        const msg = e?.message || 'Patronage failed';
        setError(msg);
        throw e;
      } finally {
        setPending(false);
      }
    },
    [program, wallet, connection]
  );

  return { patronize, isPending, error, signature };
}
