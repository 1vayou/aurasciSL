# Deployment record — AuraSci on Solana Devnet

This file records the on-chain deployment of the AuraSci Anchor program for the Colosseum Solana Frontier Hackathon submission.

## On-chain program

| Field | Value |
| --- | --- |
| Cluster | Solana **Devnet** |
| Program ID | [`2J766XS6NbvebT1sdsMgLtLPf5cL1dmHr5ko5LwJ2SiE`](https://explorer.solana.com/address/2J766XS6NbvebT1sdsMgLtLPf5cL1dmHr5ko5LwJ2SiE?cluster=devnet) |
| Source | [`programs/aurasci/src/lib.rs`](../programs/aurasci/src/lib.rs) |
| Framework | Anchor 0.30 |
| Deployed via | [Solana Playground](https://beta.solpg.io) |
| Authority | Playground-managed keypair (transferable to a multisig in Phase 3) |

## What's on-chain

| Instruction | Purpose |
| --- | --- |
| `register_scientist` | Create the `Scientist` PDA, optionally with an ORCID hash |
| `publish_intent` | Mint `IntentAsset` + 3 `Milestone` PDAs + a PDA-owned USDC `Escrow Vault`, stamping the AI Gatekeeper score |
| `patronize` | Transfer USDC from a patron ATA into the Escrow Vault; record a `Patronage` PDA |
| `submit_proof` | Scientist commits SHA-256 + IPFS URI of milestone evidence on-chain |
| `verify_milestone` | AI Verifier signer releases the milestone tranche from Escrow → Scientist USDC ATA |
| `refund` | Refund a patronage if the intent is rejected |

Five account types:

- `Scientist` — per-wallet researcher record
- `IntentAsset` — research proposal with goal + 3 milestones
- `Milestone` — exactly 3 per intent, with proof commitment + AI score
- `Patronage` — USDC contribution from a patron
- `Escrow Vault` — PDA-owned USDC token account holding patronage funds

Three events for off-chain indexers: `IntentPublished`, `PatronageMade`, `MilestoneVerified`.

## How the live demo uses it

The live demo at [aurasci-sl.vercel.app](https://aurasci-sl.vercel.app) wires:

1. **Phantom wallet** via `@solana/web3.js` (CDN-loaded, no build step).
2. **Login flow** unified into a single button — connects Phantom on click.
3. **"Fund this research"** sends a real **Solana devnet** transaction. The current demo uses a SystemProgram transfer of `0.001 SOL` for cost-free demonstration; the Anchor program's `patronize` instruction is ready to be wired in once the IntentAsset accounts are seeded on-chain.
4. **Activity feed** shows live tx confirmations with a clickable Solana Explorer link.

The `programId` constant in [`public/solana-integration.js`](../public/solana-integration.js) already references the deployed program — wiring the Anchor `patronize` call is the next iteration.

## How to verify

1. Open the Solana Explorer link in the table above.
2. You should see a deployed BPF program owned by `BPFLoaderUpgradeab1e11111111111111111111111`.
3. The program's IDL is in [`src/solana/program/aurasci_program.ts`](../src/solana/program/aurasci_program.ts).

## Re-deployment / upgrade

The program is upgradeable. To push a new build:

1. Open the same Anchor source in [Solana Playground](https://beta.solpg.io).
2. **Build** → wait for "Build successful".
3. Click **Upgrade** (not "Deploy" — the program ID is locked to the existing one).
4. Sign with the Playground wallet that originally deployed it.

To migrate the authority to a multisig (Phase 3), use `solana program set-upgrade-authority`.

## Cost

| Item | Cost (devnet SOL) |
| --- | --- |
| First-time deploy | ~1.4 SOL |
| Each upgrade | ~0.1 SOL |
| Per-instruction call | <0.00001 SOL |

All devnet — no real money. Mainnet pricing for the same program is ~$50 first-time deploy and fractions of a cent per call.
