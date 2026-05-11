# AuraSci — On-chain Open-Science Funding on Solana

> **From Proof to Capital.** Milestone-based science funding where AI agents
> screen research, scientists commit cryptographic proofs, and capital is
> released atomically from a Solana escrow vault.

[![Devnet](https://img.shields.io/badge/Devnet-2J766XS6...wJ2SiE-9945FF?style=for-the-badge&logo=solana)](https://explorer.solana.com/address/2J766XS6NbvebT1sdsMgLtLPf5cL1dmHr5ko5LwJ2SiE?cluster=devnet)
[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?style=for-the-badge&logo=solana)](https://explorer.solana.com/?cluster=devnet)
[![Anchor](https://img.shields.io/badge/Anchor-0.30-0E1117?style=for-the-badge)](https://www.anchor-lang.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Hackathon](https://img.shields.io/badge/Colosseum-Solana%20Frontier-00FF88?style=for-the-badge)](https://arena.colosseum.org/hackathon)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](#license)

🌐 **Live demo:** https://aurasci-sl.vercel.app
📍 **Deployed program (devnet):** [`2J766XS6NbvebT1sdsMgLtLPf5cL1dmHr5ko5LwJ2SiE`](https://explorer.solana.com/address/2J766XS6NbvebT1sdsMgLtLPf5cL1dmHr5ko5LwJ2SiE?cluster=devnet)
🏛 **Submitting to:** Colosseum Solana Frontier Hackathon

---

## ✨ Why AuraSci

Open science is funded today through grants that take 9–18 months to clear
and pay out in lump sums with no real accountability after the cheque clears.
AuraSci replaces the cheque with a **programmable escrow on Solana** that
releases capital tranche by tranche, gated by an **AI Verifier** that scores
the proof a scientist submits for each milestone.

Three primitives, all on-chain:

| Primitive | What it is | On-chain account |
| --- | --- | --- |
| **IntentAsset** | A research proposal with funding goal + 3 milestones | `IntentAsset` PDA |
| **Patronage** | A patron's USDC contribution to an intent | `Patronage` PDA |
| **Milestone NFT** | Soul-bound proof minted to the scientist on each verified release | Metaplex Token Metadata |

No tokens, no speculation, no rug pulls. Just **verified research → released capital**.

---

## 🧬 What's actually on Solana

Everything that matters is on-chain. The AI lives off-chain because models
shouldn't run inside a BPF program — but the AI's *signature on a milestone*
is what releases the funds, and that signature is verified by the program.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AuraSci Anchor Program                       │
│                                                                      │
│   ┌───────────┐   ┌──────────────┐   ┌───────────┐   ┌──────────┐    │
│   │ Scientist │──▶│ IntentAsset  │──▶│ Milestone │   │ Patronage│    │
│   │   PDA     │   │     PDA      │   │  PDA × 3  │   │   PDA    │    │
│   └───────────┘   └──────┬───────┘   └─────┬─────┘   └────┬─────┘    │
│                          │                 │              │          │
│                          ▼                 ▼              ▼          │
│                   ┌─────────────────────────────────────────────┐    │
│                   │        Escrow Vault  (USDC ATA, PDA-owned) │    │
│                   └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                  ▲                                ▲
                  │ patronize(amount)              │ verify_milestone(score)
                  │                                │
            ┌─────┴───────┐                  ┌─────┴───────┐
            │  Phantom /  │                  │ AI Verifier │
            │  Solflare   │                  │  Keypair    │
            │   Wallet    │                  │ (server)    │
            └─────────────┘                  └─────────────┘
```

### Instructions

| Instruction | Caller | What it does |
| --- | --- | --- |
| `register_scientist` | Scientist wallet | Creates Scientist PDA with optional ORCID hash |
| `publish_intent` | Scientist wallet | Mints IntentAsset + 3 Milestones + Escrow Vault, stamps AI Gatekeeper score |
| `patronize` | Patron wallet | Transfers USDC into the Escrow Vault, mints Patron Receipt |
| `submit_proof` | Scientist wallet | Commits SHA-256 + IPFS URI of milestone evidence |
| `verify_milestone` | AI Verifier signer | Releases tranche from Vault → Scientist USDC ATA, mints Milestone NFT |
| `refund` | Patron wallet | If intent is `Rejected`, claws back original deposit |

All instructions live in [`programs/aurasci/src/lib.rs`](programs/aurasci/src/lib.rs).
TypeScript bindings + IDL: [`src/solana/program/aurasci_program.ts`](src/solana/program/aurasci_program.ts).

---

## 🔌 Solana integrations checklist

| Capability | Library | Where |
| --- | --- | --- |
| Phantom / Solflare / Backpack wallet connect | `@solana/wallet-adapter-*` | [`src/solana/components/WalletProvider.tsx`](src/solana/components/WalletProvider.tsx) |
| USDC SPL token transfer with ATA bootstrap | `@solana/spl-token` | [`src/solana/lib/usdc.ts`](src/solana/lib/usdc.ts) |
| PDA-owned escrow vault | Anchor + SPL Token | [`programs/aurasci/src/lib.rs`](programs/aurasci/src/lib.rs) |
| Milestone NFT minting (Metaplex Token Metadata) | `@metaplex-foundation/mpl-token-metadata` | [`src/solana/lib/nft.ts`](src/solana/lib/nft.ts) |
| Live program-event activity feed | Anchor `addEventListener` | [`src/solana/hooks/useOnChainActivity.ts`](src/solana/hooks/useOnChainActivity.ts) |
| Off-chain proof storage (IPFS / Pinata) | Pinata REST API | [`src/app/api/ipfs-upload/route.ts`](src/app/api/ipfs-upload/route.ts) |
| AI Verifier server-side signer | `@coral-xyz/anchor` + LLM | [`src/app/api/ai-verifier/route.ts`](src/app/api/ai-verifier/route.ts) |

---

## 🧠 Why the AI lives off-chain (and why that's still trustless)

Models can't run on a Solana validator, but the **signature** of the AI
verifier keypair can be checked on-chain. The flow:

1. Scientist uploads a paper / dataset / commit log → the file is pinned to
   IPFS and a SHA-256 digest is computed in the **browser**.
2. `submit_proof` writes `{proofUri, sha256}` to the Milestone PDA.
3. Our `/api/ai-verifier` Next.js route fetches the file from IPFS, runs an
   LLM grading rubric against the milestone description, and returns a score
   in `0..100`.
4. If the score ≥ 70 the route signs `verify_milestone` with the program's
   AI Verifier keypair (whose pubkey is constrained inside `lib.rs`).
5. The program checks `signer.key() == AI_VERIFIER_PUBKEY` and only then
   releases the milestone tranche from escrow.

If the model is wrong, the patron retains the on-chain receipt and can
challenge through governance (Phase 3). The point is that **fund release
requires a cryptographic signature from the AI Verifier**, not a database
write that anyone can fake.

---

## 🚀 Quick start (devnet)

### Prerequisites

- Node 20+
- Rust + Anchor CLI 0.30 (`cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --locked`)
- Solana CLI (`sh -c "$(curl -sSfL https://release.solana.com/stable/install)"`)
- `solana config set --url devnet && solana airdrop 2`

### 1. Clone and install

```bash
git clone https://github.com/1vayou/aurasci.git
cd aurasci
npm install
cp .env.local.example .env.local
```

### 2. Build & deploy the Anchor program

```bash
npm run anchor:build
npm run anchor:deploy:devnet     # prints a Program ID
```

Copy the printed Program ID into:

- `Anchor.toml` → `[programs.devnet]`
- `programs/aurasci/src/lib.rs` → `declare_id!(...)`
- `.env.local` → `NEXT_PUBLIC_AURASCI_PROGRAM_ID`

### 3. Seed the demo intents

```bash
npm run seed:devnet
```

This creates the three hero intents (`$CELL-01`, `$NEUR-01`, `$GENE-01`)
that the live frontend already references.

### 4. Run the app

```bash
npm run dev
# → http://localhost:3000
```

Connect a Phantom wallet (devnet mode), grab some devnet USDC from the
[SPL Token Faucet](https://spl-token-faucet.com/?token-name=USDC-Dev), and
patronize an intent. Watch the funds move on
[Solana Explorer](https://explorer.solana.com/?cluster=devnet).

---

## 🎮 5-minute demo script

1. **Open the live app.** The landing page lists the live ticker `$CELL-01`.
2. **Connect a Solana wallet.** The button in the top nav swaps to a wallet
   address chip; the activity feed switches from mock to live program events.
3. **Patronize.** From `/intent/[id]`, click *Patronize $250 USDC* → sign
   in Phantom → tx confirms → activity feed shows
   `💎 7Hxq…X9Vk patronized $250` with a clickable Solana Explorer link.
4. **Scientist proof submission.** Switch to the Scientist account, upload a
   PDF on the dashboard, the browser computes SHA-256, the file is pinned to
   IPFS, and `submit_proof` is sent.
5. **AI verification.** Hit *[Dev] Trigger AI Verifier* — the API route runs
   the LLM rubric, signs `verify_milestone`, USDC moves from the program
   vault to the scientist's ATA, and a milestone NFT is minted to them.

Every step has a clickable explorer link, so judges can audit the chain.

---

## 🛠 Repository layout

```
aurasci/
├── programs/aurasci/             # Anchor program (Rust)
│   ├── Cargo.toml
│   └── src/lib.rs
├── src/
│   ├── app/                      # Next 14 App Router pages (existing)
│   │   ├── api/
│   │   │   ├── ai-verifier/      # Server-side LLM scorer + signer
│   │   │   └── ipfs-upload/      # Pinata pinning proxy
│   │   └── …
│   ├── solana/
│   │   ├── components/
│   │   │   ├── WalletProvider.tsx
│   │   │   ├── WalletButton.tsx
│   │   │   └── PatronizeButton.tsx
│   │   ├── hooks/
│   │   │   ├── useAnchorProgram.ts
│   │   │   ├── usePatronage.ts
│   │   │   ├── useMilestone.ts
│   │   │   ├── useOnChainIntent.ts
│   │   │   └── useOnChainActivity.ts
│   │   ├── lib/
│   │   │   ├── connection.ts
│   │   │   ├── pdas.ts
│   │   │   ├── usdc.ts
│   │   │   ├── escrow.ts
│   │   │   └── nft.ts
│   │   └── program/
│   │       └── aurasci_program.ts
│   ├── components/               # existing sci-fi UI (ActivityFeed, etc.)
│   ├── store/                    # existing Zustand store
│   └── lib/mock-data.ts          # existing mock data, used as devnet seed
├── scripts/
│   └── seed-devnet.ts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── HACKATHON_SUBMISSION.md
│   └── FORK_GUIDE.md
├── Anchor.toml
├── .env.local.example
└── package.json
```

---

## 📊 Phase 2 = This Hackathon

The original AuraSci MVP was Phase 1 (frontend + mock data). This Solana
integration *is* Phase 2:

| Phase | Status | Scope |
| --- | --- | --- |
| **Phase 1** | ✅ Shipped | Frontend MVP, mock store, 3 demo intents |
| **Phase 2** | 🟢 **In this PR** | Anchor program, USDC escrow, wallet adapter, AI Verifier signer, NFT receipts |
| **Phase 3** | 🔒 Planned | Governance, patron-DAO challenges, leaderboard, mainnet launch |

---

## 🏆 Why this fits Colosseum

Solana Frontier Hackathon judges look for products that **could not exist
on any other chain**. AuraSci's release semantics — sub-second tranche
disbursement, a server-side AI signer that pays sub-cent fees per
verification, NFT receipts at near-zero cost — are only viable on Solana.

We're shipping, not pitching:

- 6 instruction handlers, 4 account types, 3 events on-chain
- Phantom / Solflare / Backpack out of the box
- USDC SPL with auto-ATA bootstrap
- Live event subscription wired into the existing CRT activity feed
- Server-side AI Verifier that satisfies on-chain signer constraints
- IPFS pinning for tamper-evident proof storage

We're not starting from a blank repo. The reference UI is already live at
<https://aurasci.vercel.app> (built by [Ellie Liu](#-team)) — this
submission is the **Solana-enhanced fork** at <https://aurasci-sl.vercel.app>,
with a real Anchor program deployed to devnet, Phantom wallet flow, and
live on-chain patronage on the same UI.

---

## 📚 Docs

- [Architecture deep-dive](docs/ARCHITECTURE.md)
- [Hackathon submission summary](docs/HACKATHON_SUBMISSION.md)
- [Devnet deployment record](docs/DEPLOYMENT.md) — Program ID, instructions, how to verify
- [How to fork + deploy locally](docs/FORK_GUIDE.md)

## 📄 License

MIT © 2026 AuraSci

---

> **AuraSci — Where breakthroughs find believers, and capital follows proof.**
