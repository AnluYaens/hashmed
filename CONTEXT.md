# HashMed — Context for AI Coding Agents

## What HashMed is

HashMed is a pay-per-read medical lab-results marketplace. A lab uploads a report
(PDF) with a micro-price. A clinic or patient who wants that report hits HTTP 402
"Payment Required", pays ~$0.001 in HBAR via the x402 protocol using the HashPack
wallet, the payment settles on Hedera testnet in seconds, and a short-lived download
URL unlocks that single read. No accounts, no subscriptions, no logins.
Only synthetic / fake lab data is ever used.

Built by forking the official template `github.com/hedera-dev/scaffold-hbar`,
branch `templates/x402-pay-per-use`, and reskinning it to the medical domain.

## The bounty

- Entry for the Hedera x402 bounty (see the official hedera.com x402-bounty page).
- Judging emphasis: a working end-to-end flow, real on-chain payments through x402,
  and how well the build uses Hedera rails.
- Submission requires: a public open-source GitHub repo; real Hedera testnet
  transactions with HashScan links; a demo video under 5 minutes; and the
  submission form.
- Deadline: July 31, 11:59 PM ET. Today is ~July 29 (about two days).
- VERIFY LOCALLY: re-read the exact bounty rules, prize, and submission-form fields
  on the official bounty page before submitting. Do not rely on secondhand summaries.

## Why x402 + Hedera fits

x402 is an open standard built on the HTTP 402 "Payment Required" status code, so an
app or agent can pay for a single request as easily as making an HTTP call. Hedera's
"exact" payment scheme was accepted into x402 with a TypeScript reference
implementation built on the Hiero SDK. In that scheme the payment is a native HBAR
(or HTS token) TransferTransaction: the buyer PARTIALLY signs it in their wallet, and
the facilitator co-signs as the fee-payer and submits it on-chain. That is exactly the
pay-per-read mechanic HashMed demonstrates.

## Tech stack & architecture

- Monorepo: Yarn 3 workspaces (Yarn 3.2.3). Package manager is Yarn — npm/pnpm are
  NOT supported by scaffold-hbar. Node 20 LTS required (repo declares Node >=20.18.3).
- `packages/nextjs` — the Next.js app: storefront UI, the x402 resource server
  (returns 402 + payment requirements, verifies payment, unlocks download), and
  presigned MinIO upload/download routes.
- `packages/hardhat` — the Solidity `FileRegistry` contract plus its unit tests
  (~22 passing tests). On-chain registry of listed files/prices. DO NOT MODIFY.
- `facilitator/` — a self-hosted x402 Hedera facilitator (Docker). Verifies the
  buyer's partially-signed transfer, co-signs as ECDSA fee-payer, submits to testnet.
- `docker-compose` brings up MinIO (object storage for PDFs) and the facilitator.
  Ports (verify locally against the compose file): MinIO :9000 (S3 API) and :9001
  (console) — these are the standard MinIO defaults; facilitator :4020 is
  template-specific.
- Wallet: HashPack via WalletConnect / Reown AppKit using the native `hedera`
  namespace ONLY. Do NOT use the `eip155` HederaAdapter — it is deprecated. Native
  HBAR transfers use HIP-820 methods such as `hedera_signTransaction` (collects a
  signature without executing).
- Payments: native Hedera `TransferTransaction`. Buyer partially signs in HashPack;
  facilitator adds its ECDSA fee-payer signature and submits.
- Marketplace reads use on-chain `getFileCount()` / `getFiles()` view calls, NOT
  event logs. Reason: Hedera JSON-RPC relays cap `eth_getLogs` at a 10,000-block
  range, so the template deliberately avoids log-scanning. Do NOT "optimize" this
  into event-log reads.
- x402 SDK: `@x402/hedera` (x402 Foundation); it uses the Hedera SDK
  `@hiero-ledger/sdk` (the Hiero SDK that replaced `@hashgraph/sdk`). The buyer signer
  is created with an ECDSA key, e.g. `PrivateKey.fromStringECDSA(...)`, network
  `hedera:testnet`. VERIFY LOCALLY: confirm the exact package(s)/versions the branch
  imports — it may vendor `hedera-dev/x402-hedera` instead of installing `@x402/hedera`.

## Environment & prerequisites

- Node 20 LTS (>=20.18.3). Use the repo's pinned Yarn 3 (via `.yarnrc.yml` / `.yarn/`).
- Docker + docker-compose (MinIO + facilitator).
- A FUNDED ECDSA Hedera testnet account. Create it at `portal.hedera.com` — click
  CREATE ECDSA ACCOUNT (portal accounts default to ED25519; x402 on Hedera needs
  ECDSA). Funding: the Portal refills up to 1,000 testnet HBAR once per 24h; the
  standalone faucet gives up to 100 testnet HBAR every 24h.
- `.env` values the template needs (verify names against `.env.example`):
  `FACILITATOR_ACCOUNT_ID`, `FACILITATOR_PRIVATE_KEY` (the ECDSA fee-payer), and
  `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` (from a Reown/WalletConnect Cloud project).
  Note: related official x402 Hedera examples use `HEDERA_ACCOUNT_ID` /
  `HEDERA_PRIVATE_KEY`, so the exact strings matter — diff against `.env.example`.
- Never commit `.env` or any private key.

## Two-day plan (already decided)

- Day 1 — Get the template running end-to-end on testnet, UNCHANGED. Complete one
  real x402 payment and SAVE its HashScan link. Do not reskin yet.
- Day 2 — Reskin to the medical domain in the Next.js layer ONLY (medical metadata
  lives entirely in the UI/metadata; the Solidity contract is untouched), polish UI,
  write the README as a pitch (use case, architecture diagram, HashScan links up top),
  record the <5-min demo, submit with buffer.
- Keep EVERY HashScan link from test transactions — they are demo/README evidence.

## Hard constraints

1. Do NOT modify the Solidity contract in `packages/hardhat` (no edits, no redeploys
   of a changed contract). The medical layer is a Next.js/UI/metadata concern only.
2. Synthetic / fake lab data only. Never use real patient data.
3. Keep every HashScan link from test transactions.
4. All deliverables (README, docs, demo narration, submission text) in English.
5. Node 20 LTS.
6. ECDSA keys only (ED25519 will break the x402 Hedera signer).

## Pointers to the template's own docs

The template already ships `README.md`, `RUNBOOK.md`, `CLAUDE.md`, `AGENTS.md`, a
`.cursor/` folder (rules/skills/agents/mcp.json), and `.opencode/`. These are the
authority for exact commands and setup. CONTEXT.md / PHASES.md / AGENTS.md COMPLEMENT
them — when in doubt, the template's `RUNBOOK.md` and `package.json` scripts win.
Read `RUNBOOK.md` first before running anything.
