'use client';

import { FC, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { Sparkles, Loader2, ExternalLink } from 'lucide-react';
import { usePatronage } from '../hooks/usePatronage';

interface PatronizeButtonProps {
  scientist: string; // base58
  intentId: string; // u64 as decimal string
  amountUsdc: number;
  /** Called with the tx signature once the patronage is confirmed. */
  onSuccess?: (signature: string) => void;
}

/**
 * Drop-in replacement for the existing mock "Fund" button on the Intent
 * Detail page. Falls back to a "Connect wallet" prompt if the user hasn't
 * connected, then prompts them to sign the patronage tx.
 *
 * Visually matches AuraSci's neon button style (gradient + shadow glow).
 */
export const PatronizeButton: FC<PatronizeButtonProps> = ({
  scientist,
  intentId,
  amountUsdc,
  onSuccess,
}) => {
  const { connected } = useWallet();
  const { patronize, isPending, error } = usePatronage();
  const [signature, setSignature] = useState<string | null>(null);

  const handleClick = async () => {
    if (!connected) return;
    try {
      const r = await patronize({
        scientist: new PublicKey(scientist),
        intentId: BigInt(intentId),
        amountUsdc,
      });
      setSignature(r.signature);
      onSuccess?.(r.signature);
    } catch {
      /* error is exposed via the hook */
    }
  };

  if (!connected) {
    return (
      <div className="rounded-md border border-amber-400/40 bg-black/40 px-4 py-3 font-mono text-sm text-amber-300">
        Connect a Solana wallet above to patronize this intent.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="group relative flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 font-mono text-sm font-bold text-black shadow-[0_0_24px_rgba(16,185,129,0.4)] transition hover:shadow-[0_0_32px_rgba(16,185,129,0.7)] disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {isPending
          ? 'Sending patronage…'
          : `Patronize $${amountUsdc.toLocaleString()} USDC`}
      </button>

      {signature && (
        <a
          href={`https://explorer.solana.com/tx/${signature}?cluster=${process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet'}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-xs text-emerald-300 hover:underline"
        >
          View on Solana Explorer <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {error && (
        <p className="font-mono text-xs text-red-400">⚠ {error}</p>
      )}
    </div>
  );
};
