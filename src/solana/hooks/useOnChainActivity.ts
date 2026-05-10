'use client';

import { useEffect, useState } from 'react';
import { useAnchorProgram } from './useAnchorProgram';
import { shortAddress } from '../lib/connection';

export interface OnChainActivityEntry {
  id: string;
  type: 'patronage' | 'proof_submitted' | 'ai_verified' | 'intent_published';
  message: string;
  /** Slot the event was emitted at — used for ordering. */
  slot?: number;
  /** Solana Explorer URL for the originating tx. */
  explorerUrl?: string;
}

/**
 * Subscribes to AuraSci program events and pushes them into a list that the
 * existing <ActivityFeed/> CRT terminal can render unchanged. Fully replaces
 * the mock Zustand activity log when a wallet is connected.
 */
export function useOnChainActivity(): OnChainActivityEntry[] {
  const program = useAnchorProgram();
  const [events, setEvents] = useState<OnChainActivityEntry[]>([]);

  useEffect(() => {
    if (!program) return;

    const cluster = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
    const explorerTx = (sig: string) =>
      `https://explorer.solana.com/tx/${sig}?cluster=${cluster}`;

    const listeners: number[] = [];

    listeners.push(
      program.addEventListener('IntentPublished', (ev: any, slot: number, sig: string) => {
        setEvents((prev) => [
          {
            id: `${ev.intent.toBase58()}-${slot}`,
            type: 'intent_published',
            message: `🚀 Intent ${ev.ticker} published — goal $${(Number(ev.fundingGoal) / 1e6).toLocaleString()} (AI score ${ev.aiScore})`,
            slot,
            explorerUrl: sig ? explorerTx(sig) : undefined,
          },
          ...prev.slice(0, 49),
        ]);
      })
    );

    listeners.push(
      program.addEventListener('PatronageMade', (ev: any, slot: number, sig: string) => {
        setEvents((prev) => [
          {
            id: `${ev.intent.toBase58()}-${ev.patron.toBase58()}-${slot}`,
            type: 'patronage',
            message: `💎 ${shortAddress(ev.patron)} patronized $${(Number(ev.amount) / 1e6).toLocaleString()}`,
            slot,
            explorerUrl: sig ? explorerTx(sig) : undefined,
          },
          ...prev.slice(0, 49),
        ]);
      })
    );

    listeners.push(
      program.addEventListener('MilestoneVerified', (ev: any, slot: number, sig: string) => {
        setEvents((prev) => [
          {
            id: `${ev.intent.toBase58()}-${ev.milestoneIndex}-${slot}`,
            type: 'ai_verified',
            message: `✅ M${ev.milestoneIndex + 1} verified (AI ${ev.aiScore}) — releasing $${(Number(ev.releaseAmount) / 1e6).toLocaleString()}`,
            slot,
            explorerUrl: sig ? explorerTx(sig) : undefined,
          },
          ...prev.slice(0, 49),
        ]);
      })
    );

    return () => {
      listeners.forEach((l) => program.removeEventListener(l));
    };
  }, [program]);

  return events;
}
