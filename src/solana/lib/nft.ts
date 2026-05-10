import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createNft,
  mplTokenMetadata,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import {
  generateSigner,
  keypairIdentity,
  publicKey,
  some,
  Umi,
} from '@metaplex-foundation/umi';
import { RPC_URL } from './connection';

/**
 * Soul-bound NFTs minted by AuraSci. Two flavors:
 *
 *   PatronReceipt   — minted to a patron when they fund an intent
 *   MilestoneProof  — minted to a scientist when AI verifies a milestone
 *
 * Both use `TokenStandard.NonFungible` (Metaplex Core compatible). The
 * server-side Umi instance signs as the program's NFT authority — this is
 * separate from the user's wallet so the user doesn't have to sign twice.
 */

export type AuraNftKind = 'patron-receipt' | 'milestone-proof';

export interface MintAuraNftParams {
  recipient: string; // base58 wallet address
  kind: AuraNftKind;
  name: string; // e.g. "AuraSci Milestone M1 — $CELL-01"
  symbol: string; // e.g. "AURA-MS"
  metadataUri: string; // ipfs://… JSON metadata
  /** Royalty in basis points. AuraSci sets 0 — these are commemorative. */
  royaltyBps?: number;
}

/**
 * Returns a Umi instance configured with the AuraSci NFT authority signer.
 * MUST run server-side only (Node API route, scheduled job).
 */
export function getAuraSciUmi(authoritySecret: Uint8Array): Umi {
  const umi = createUmi(RPC_URL).use(mplTokenMetadata());
  const signer = umi.eddsa.createKeypairFromSecretKey(authoritySecret);
  return umi.use(keypairIdentity(signer));
}

export async function mintAuraNft(
  umi: Umi,
  params: MintAuraNftParams
): Promise<{ mint: string; signature: string }> {
  const mint = generateSigner(umi);

  const sig = await createNft(umi, {
    mint,
    name: params.name,
    symbol: params.symbol,
    uri: params.metadataUri,
    sellerFeeBasisPoints: { basisPoints: BigInt(params.royaltyBps ?? 0), identifier: '%', decimals: 2 } as any,
    tokenOwner: publicKey(params.recipient),
    isCollection: false,
    tokenStandard: TokenStandard.NonFungible,
  }).sendAndConfirm(umi);

  return {
    mint: mint.publicKey.toString(),
    signature: Buffer.from(sig.signature).toString('base64'),
  };
}
