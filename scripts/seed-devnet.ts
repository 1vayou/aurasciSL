/**
 * scripts/seed-devnet.ts — Populate devnet with the 3 mock intents that
 * the existing AuraSci frontend already references ($CELL-01, $NEUR-01,
 * $GENE-01) so the demo "feels real" the moment a wallet connects.
 *
 * Usage:
 *   solana-keygen new -o ~/.config/solana/id.json    # fund with `solana airdrop 2`
 *   ts-node scripts/seed-devnet.ts
 */

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, BN, Wallet } from '@coral-xyz/anchor';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { getProgram, buildPublishIntentTx } from '../src/solana/lib/escrow';
import { RPC_URL } from '../src/solana/lib/connection';

async function main() {
  const keyPath =
    process.env.SOLANA_KEYPAIR ?? path.join(os.homedir(), '.config/solana/id.json');
  const secret = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
  const scientist = Keypair.fromSecretKey(Uint8Array.from(secret));

  const connection = new Connection(RPC_URL, 'confirmed');
  const provider = new AnchorProvider(connection, new Wallet(scientist), {
    commitment: 'confirmed',
  });
  const program = getProgram(provider);

  // 1. Register the scientist
  const [scientistAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('scientist'), scientist.publicKey.toBuffer()],
    program.programId
  );

  console.log('Registering scientist…', scientist.publicKey.toBase58());
  await program.methods
    .registerScientist(
      'Dr. AuraSci Demo',
      Array(32).fill(0) as any,
      'ipfs://demo-scientist-metadata'
    )
    .accounts({
      scientist: scientist.publicKey,
      scientistAccount,
      systemProgram: PublicKey.default,
    })
    .rpc()
    .catch((e) => {
      if (!String(e).includes('already in use')) throw e;
      console.log('  (already registered, continuing)');
    });

  // 2. Publish the 3 hero intents
  const intents = [
    {
      id: 1n,
      ticker: '$CELL-01',
      uri: 'ipfs://CELL-01-metadata',
      goal: 50_000,
      tranches: [10_000, 20_000, 20_000] as [number, number, number],
      aiScore: 92,
    },
    {
      id: 2n,
      ticker: '$NEUR-01',
      uri: 'ipfs://NEUR-01-metadata',
      goal: 80_000,
      tranches: [16_000, 32_000, 32_000] as [number, number, number],
      aiScore: 87,
    },
    {
      id: 3n,
      ticker: '$GENE-01',
      uri: 'ipfs://GENE-01-metadata',
      goal: 35_000,
      tranches: [7_000, 14_000, 14_000] as [number, number, number],
      aiScore: 95,
    },
  ];

  for (const i of intents) {
    console.log(`Publishing ${i.ticker}…`);
    const tx = await buildPublishIntentTx({
      program,
      scientist: scientist.publicKey,
      intentId: i.id,
      ticker: i.ticker,
      metadataUri: i.uri,
      fundingGoalUsdc: i.goal,
      milestoneAmounts: i.tranches,
      aiScore: i.aiScore,
    });
    const sig = await provider.sendAndConfirm(tx);
    console.log(`  ✓ ${sig}`);
  }

  console.log('\nDevnet seed complete. Visit /market to see the on-chain intents.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
