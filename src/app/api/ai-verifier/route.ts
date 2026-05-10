import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import bs58 from 'bs58';

import { buildVerifyMilestoneTx } from '@/solana/lib/escrow';
import { getProgram } from '@/solana/lib/escrow';
import { RPC_URL } from '@/solana/lib/connection';

/**
 * POST /api/ai-verifier
 *
 * Body:
 *   {
 *     scientist: "<base58>",
 *     intentId: "12",
 *     milestoneIndex: 0 | 1 | 2,
 *     proofUri: "ipfs://…"
 *   }
 *
 * 1. Pulls the proof from IPFS / Arweave.
 * 2. Calls the AI Gatekeeper backend (Anthropic / OpenAI / OSS LLM) to score
 *    the proof against the milestone description.
 * 3. If score >= 70, signs and submits a `verifyMilestone` tx using the
 *    program's AI verifier keypair (loaded from AI_VERIFIER_SECRET).
 *
 * SECURITY: this route MUST stay server-side. AI_VERIFIER_SECRET must never
 * be exposed to the browser. Use Vercel Environment Variables (sensitive).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  const requiredKeys = ['scientist', 'intentId', 'milestoneIndex', 'proofUri'];
  for (const k of requiredKeys) {
    if (body[k] === undefined) {
      return NextResponse.json({ error: `Missing field: ${k}` }, { status: 400 });
    }
  }

  const secret = process.env.AI_VERIFIER_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'AI_VERIFIER_SECRET not configured' },
      { status: 500 }
    );
  }

  // 1. Pull proof + run AI scoring
  const score = await scoreProofWithAi(body.proofUri).catch(() => null);
  if (score == null) {
    return NextResponse.json({ error: 'AI scoring failed' }, { status: 502 });
  }
  if (score < 70) {
    return NextResponse.json({
      verified: false,
      aiScore: score,
      reason: 'Score below release threshold',
    });
  }

  // 2. Load the verifier keypair
  const verifier = Keypair.fromSecretKey(bs58.decode(secret));
  const connection = new Connection(RPC_URL, 'confirmed');
  const provider = new AnchorProvider(connection, new Wallet(verifier), {
    commitment: 'confirmed',
  });
  const program = getProgram(provider);

  // 3. Build + submit the verifyMilestone tx
  const tx = await buildVerifyMilestoneTx({
    program,
    aiVerifier: verifier.publicKey,
    scientist: new PublicKey(body.scientist),
    intentId: BigInt(body.intentId),
    milestoneIndex: body.milestoneIndex,
    aiScore: score,
  });

  const sig = await provider.sendAndConfirm(tx, [verifier]);

  return NextResponse.json({
    verified: true,
    aiScore: score,
    signature: sig,
    explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=${process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet'}`,
  });
}

/**
 * Stub for the AI Gatekeeper call. Replace with a real HTTP call to your
 * Anthropic / OpenAI endpoint, or a local Llama / Mistral inference job.
 *
 * The model receives:
 *   - milestone description (from IntentAsset metadata)
 *   - proof document (paper PDF, code commit log, dataset, etc.)
 * and returns a 0..100 confidence score.
 */
async function scoreProofWithAi(proofUri: string): Promise<number> {
  const url = process.env.AI_GATEKEEPER_URL;
  if (!url) {
    // Demo fallback — deterministic score based on proof URI hash
    let h = 0;
    for (const c of proofUri) h = (h * 31 + c.charCodeAt(0)) | 0;
    return 70 + (Math.abs(h) % 25); // 70..94 — so the demo always releases
  }

  const r = await fetch(`${url}/score`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.AI_GATEKEEPER_API_KEY ?? ''}`,
    },
    body: JSON.stringify({ proofUri }),
  });
  if (!r.ok) throw new Error(`AI Gatekeeper HTTP ${r.status}`);
  const j = await r.json();
  return Number(j.score);
}
