'use client';

import { FC } from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { Wallet } from 'lucide-react';

/**
 * WalletButton — sci-fi styled wallet connect button.
 *
 * Wraps WalletMultiButton from @solana/wallet-adapter-react-ui and applies
 * AuraSci's neon-green / glassmorphism theme so it blends with the rest
 * of the cyberpunk UI.
 */
export const WalletButton: FC = () => {
  const { publicKey, connected } = useWallet();

  return (
    <div className="aura-wallet-button group relative">
      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-400/40 via-cyan-400/40 to-emerald-400/40 opacity-0 blur transition-opacity group-hover:opacity-100" />
      <WalletMultiButton
        className="!relative !flex !items-center !gap-2 !rounded-lg !border !border-emerald-400/60 !bg-black/50 !px-4 !py-2 !font-mono !text-sm !text-emerald-300 !shadow-[0_0_18px_rgba(16,185,129,0.35)] hover:!bg-emerald-400/10"
        startIcon={<Wallet className="h-4 w-4" />}
      >
        {connected && publicKey
          ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
          : 'Connect Wallet'}
      </WalletMultiButton>
    </div>
  );
};
