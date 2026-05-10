'use client';

import { useMemo } from 'react';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { AuraSciIDL, AuraSci } from '../program/aurasci_program';
import { AURASCI_PROGRAM_ID } from '../lib/connection';

/**
 * Returns a typed AuraSci Anchor program instance bound to the user's
 * connected wallet. Returns `null` until the wallet is connected.
 */
export function useAnchorProgram(): Program<AuraSci> | null {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
    return new Program<AuraSci>(AuraSciIDL as any, AURASCI_PROGRAM_ID, provider);
  }, [connection, wallet]);
}
