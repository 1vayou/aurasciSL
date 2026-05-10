'use client';

import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  BackpackWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Required CSS for the wallet modal — import once at the app root.
import '@solana/wallet-adapter-react-ui/styles.css';

interface AuraSciWalletProviderProps {
  children: ReactNode;
}

/**
 * AuraSciWalletProvider — wraps the app with Solana wallet context.
 *
 * Supports Phantom, Solflare and Backpack out of the box.
 * Network is configured via NEXT_PUBLIC_SOLANA_NETWORK (default: devnet).
 *
 * Usage:
 *   // src/app/layout.tsx
 *   <AuraSciWalletProvider>{children}</AuraSciWalletProvider>
 */
export const AuraSciWalletProvider: FC<AuraSciWalletProviderProps> = ({ children }) => {
  const network =
    (process.env.NEXT_PUBLIC_SOLANA_NETWORK as WalletAdapterNetwork) ||
    WalletAdapterNetwork.Devnet;

  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(network),
    [network]
  );

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
