'use client';

import { useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useAnchorProgram } from './useAnchorProgram';
import { buildSubmitProofTx } from '../lib/escrow';

/**
 * sha256 a Blob in the browser and return the 32-byte digest.
 */
async function sha256Bytes(blob: Blob): Promise<Uint8Array> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return new Uint8Array(digest);
}

export interface UseMilestone {
  submitProof: (params: {
    intentId: bigint;
    milestoneIndex: 0 | 1 | 2;
    /** Client-side file the scientist uploaded (paper, dataset, etc). */
    proofFile: Blob;
    /** Where the file is stored — IPFS / Arweave URI. */
    proofUri: string;
  }) => Promise<{ signature: string; proofHashHex: string }>;
  isPending: boolean;
  error: string | null;
}

/**
 * useMilestone — scientist-side hook for committing proof of milestone
 * completion. The hash is computed locally so the on-chain commitment is
 * tamper-evident even if the IPFS gateway later goes down.
 *
 * The matching `verifyMilestone` step is performed off-chain by the AI
 * Verifier service — it has its own keypair authorised by the program.
 */
export function useMilestone(): UseMilestone {
  const { connection } = useConnection();
  const wallet = useWallet();
  const program = useAnchorProgram();

  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitProof = useCallback<UseMilestone['submitProof']>(
    async ({ intentId, milestoneIndex, proofFile, proofUri }) => {
      if (!program || !wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected');
      }

      setPending(true);
      setError(null);

      try {
        const hash = await sha256Bytes(proofFile);
        const proofHashHex = Array.from(hash)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

        const tx = await buildSubmitProofTx({
          program,
          scientist: wallet.publicKey,
          intentId,
          milestoneIndex,
          proofUri,
          proofHash: hash,
        });

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = wallet.publicKey;

        const signed = await wallet.signTransaction(tx);
        const sig = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          'confirmed'
        );

        return { signature: sig, proofHashHex };
      } catch (e: any) {
        setError(e?.message || 'Failed to submit proof');
        throw e;
      } finally {
        setPending(false);
      }
    },
    [program, wallet, connection]
  );

  return { submitProof, isPending, error };
}
