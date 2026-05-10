'use client';

import { useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useConnection } from '@solana/wallet-adapter-react';
import { useAnchorProgram } from './useAnchorProgram';
import { intentPda, milestonePda } from '../lib/pdas';

export interface OnChainIntent {
  pda: PublicKey;
  scientist: PublicKey;
  ticker: string;
  metadataUri: string;
  fundingGoal: number; // dollars
  totalRaised: number; // dollars
  totalReleased: number; // dollars
  aiScore: number;
  status: string;
  milestones: {
    index: number;
    releaseAmount: number;
    proofUri: string;
    aiScore: number;
    status: string;
  }[];
}

/**
 * Hook that loads an Intent + its 3 milestones from the chain, given the
 * scientist wallet and intent ID. The Activity Feed and Intent Detail
 * page swap from mock data to this once the wallet is connected.
 */
export function useOnChainIntent(
  scientist: PublicKey | null,
  intentId: bigint | null
): { data: OnChainIntent | null; loading: boolean; error: string | null } {
  const { connection } = useConnection();
  const program = useAnchorProgram();

  const [data, setData] = useState<OnChainIntent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!program || !scientist || intentId == null) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [intent] = intentPda(scientist, intentId);
        const [m0] = milestonePda(intent, 0);
        const [m1] = milestonePda(intent, 1);
        const [m2] = milestonePda(intent, 2);

        const [intentAcc, m0Acc, m1Acc, m2Acc] = await Promise.all([
          (program.account as any).intentAsset.fetch(intent),
          (program.account as any).milestone.fetch(m0),
          (program.account as any).milestone.fetch(m1),
          (program.account as any).milestone.fetch(m2),
        ]);
        if (cancelled) return;

        const toDollars = (n: any) => Number(n) / 1_000_000;
        const statusName = (s: any) => Object.keys(s)[0];

        setData({
          pda: intent,
          scientist: intentAcc.scientist,
          ticker: intentAcc.ticker,
          metadataUri: intentAcc.metadataUri,
          fundingGoal: toDollars(intentAcc.fundingGoal),
          totalRaised: toDollars(intentAcc.totalRaised),
          totalReleased: toDollars(intentAcc.totalReleased),
          aiScore: intentAcc.aiScore,
          status: statusName(intentAcc.status),
          milestones: [m0Acc, m1Acc, m2Acc].map((m, i) => ({
            index: i,
            releaseAmount: toDollars(m.releaseAmount),
            proofUri: m.proofUri,
            aiScore: m.aiScore,
            status: statusName(m.status),
          })),
        });
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load intent');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [program, scientist?.toBase58(), intentId?.toString(), connection]);

  return { data, loading, error };
}
