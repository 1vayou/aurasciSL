import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/ipfs-upload
 *
 * Pins a milestone proof file to IPFS via Pinata. The returned CID is used
 * by the scientist when calling `submit_proof` on the AuraSci program.
 *
 * The hash on-chain is computed from the same file in the browser (see
 * useMilestone.ts), so even if the gateway disappears the document can be
 * reconstructed and verified off-chain.
 */
export async function POST(req: NextRequest) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json(
      { error: 'PINATA_JWT not configured' },
      { status: 500 }
    );
  }

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  const pinataForm = new FormData();
  pinataForm.append('file', file as Blob, (file as any).name ?? 'proof.bin');

  const r = await fetch(
    'https://api.pinata.cloud/pinning/pinFileToIPFS',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: pinataForm as any,
    }
  );
  if (!r.ok) {
    const text = await r.text();
    return NextResponse.json(
      { error: `Pinata HTTP ${r.status}: ${text}` },
      { status: 502 }
    );
  }
  const j = await r.json();
  return NextResponse.json({
    cid: j.IpfsHash,
    uri: `ipfs://${j.IpfsHash}`,
    gatewayUrl: `${process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'}${j.IpfsHash}`,
  });
}
