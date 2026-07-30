# HashMed — pay-per-read lab results on Hedera

**A lab publishes a report. A clinic pays ~$0.0001 in HBAR through HTTP 402. The payment settles on Hedera in seconds and unlocks exactly one read. No accounts, no subscriptions, no invoices.**

Built for the [Hedera x402 bounty](https://hedera.com/x402-bounty) · Demo video: **[LINK HERE]**

## Proof it works (live on testnet)

| What                                                | Link                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Deployed `FileRegistry` contract                    | [`0.0.9841647`](https://hashscan.io/testnet/contract/0.0.9841647)                  |
| First end-to-end x402 settlement (1 HBAR)           | [HashScan ✓ SUCCESS](https://hashscan.io/testnet/transaction/1785413554.921013104) |
| Pay-per-read of a synthetic CBC report (0.001 HBAR) | [HashScan ✓ SUCCESS](https://hashscan.io/testnet/transaction/1785416899.380741104) |

More settlements and account roles in [EVIDENCE.md](./EVIDENCE.md).

## The problem

Clinical data access is priced for institutions: annual contracts, integration fees, per-seat subscriptions. If a clinic needs to see **one** lab result from another institution **once**, there is no rail for that — card fees alone are larger than a fair per-read price.

HashMed demonstrates that rail: per-read micropayments that are only viable because Hedera's fees are fixed and sub-cent, so charging $0.0001 per read doesn't get eaten by the cost of charging.

## How it works

```
Lab (publisher)                    Clinic / patient (buyer)              Facilitator (fee payer)
     │                                     │                                     │
     │ 1. upload PDF → MinIO               │                                     │
     │ 2. registerFile() on-chain          │                                     │
     │    (price, payout, metadata)        │                                     │
     │                                     │ 3. GET /api/files/:id/download      │
     │                                     │    ← HTTP 402 + price in HBAR       │
     │                                     │ 4. HashPack PARTIALLY signs a       │
     │                                     │    native TransferTransaction       │
     │                                     │──── x402 payment payload ──────────▶│
     │                                     │                                     │ 5. verifies, co-signs as
     │                                     │                                     │    ECDSA fee payer, submits
     │                                     │                                     ▼
     │                                     │                            Hedera testnet (settles in seconds)
     │                                     │ 6. ← 200 + short-lived download URL │
     ◀───────────── payout lands ──────────┴─────────────────────────────────────┘
```

- **Payments are native Hedera `TransferTransaction`s** — not wrapped tokens, not an L2. The buyer authorizes the HBAR movement; the facilitator sponsors the network fee and broadcasts.
- **Wallet integration uses the native `hedera` WalletConnect namespace** (HIP-820 `hedera_signTransaction` for partial signing), via HashPack.
- **Marketplace reads use on-chain `getFileCount()`/`getFiles()` view calls** instead of event logs — Hedera JSON-RPC relays cap `eth_getLogs` ranges, so the listing is designed around view-call pagination.
- **Medical metadata lives on-chain**, encoded as versioned JSON inside the registry's `name` field — open any `registerFile` transaction on HashScan and read the report type, lab, specimen date and patient pseudonym directly.
- **Agents can pay too**: any x402 client can buy a read without a browser — `yarn x402:buy` demonstrates a Node script paying for a report machine-to-machine.

## Synthetic data only

Every report in this demo is fabricated. PDFs are generated in-repo (`yarn workspace @sh/nextjs samples`), watermarked **"SYNTHETIC — NOT A REAL PATIENT RECORD"**, and identified only by pseudonyms (`SYN-4821`). The UI enforces pseudonym patterns and shows a permanent synthetic-data banner. Nothing here is PHI and nothing is for clinical use.

## Run it locally

Prereqs: Node 20 LTS, Docker, the HashPack extension, a WalletConnect project ID ([cloud.reown.com](https://cloud.reown.com)).

### Account setup (5 minutes, one-time)

x402's exact scheme rejects self-transfers and any payment the fee payer takes part in — by design, not an app limitation — so the demo needs **three distinct** testnet accounts:

1. **Buyer** — create an **ECDSA** account at [portal.hedera.com](https://portal.hedera.com) (it arrives funded) and import it into HashPack. Its key also deploys the contract below.
2. **Facilitator (fee payer)** — generate a fresh ECDSA keypair and send ~20 HBAR from the buyer to its EVM address; Hedera auto-creates the account. Put the new `0.0.x` id and private key in the root `.env`.
3. **Payout (the "lab")** — generate one more keypair and send it a few HBAR the same way. It only receives payments: no wallet, no further funding.

### Deploy and run

```bash
corepack enable && yarn install

# configure
cp .env.example .env                                 # facilitator id + key (account 2)
cp packages/nextjs/.env.example packages/nextjs/.env # WalletConnect project ID

# deploy + run
yarn hardhat:account:import                          # buyer key (account 1) as deployer
yarn hardhat:deploy --network hederaTestnet
yarn infra:up          # MinIO + self-hosted x402 facilitator (Docker)
yarn next:dev          # http://localhost:3000

# production mode (note: `yarn next:start` runs the dev server in this template)
yarn next:build && yarn next:serve

# verify
yarn hardhat:test      # 30 passing
```

Full setup details in [RUNBOOK.md](./RUNBOOK.md).

## What's ours vs. the template

HashMed is built on the official [`scaffold-hbar`](https://github.com/hedera-dev/scaffold-hbar) `x402-pay-per-use` reference (as the bounty suggests). On top of it we built:

- The **medical domain layer**: on-chain report metadata (versioned JSON in `name`, with graceful fallback for legacy listings), report-type catalog, pseudonym validation, synthetic sample generator + one-click publish flow
- The **Lab Report Exchange UI**: landing, exchange with search/filters, report detail with a live 402 → Sign → Settle → Unlock stepper, clickable HashScan payment receipts, self-payment guards on both publish and buy paths
- **HashMed brand system**, accessibility fixes (light-theme contrast), and hardening of the publish flow (required payout, last-used prefill)

The Solidity `FileRegistry` contract is **unchanged from the template** — deliberately: the point of x402 is that the payment rail composes with existing systems. (One test-runner timeout was raised for slow fork-mode environments; contract logic and assertions untouched.)

## Why Hedera

Fixed, predictable sub-cent fees make per-read pricing viable. Settlement finality in seconds means the "pay → unlock" moment feels instant in the UI. And native transactions plus HashScan give both sides an audit trail for free.

## Author

**Angel Jaen** — solo build. [GitHub](https://github.com/AnluYaens) · [LinkedIn](https://www.linkedin.com/in/angel-jaen-sde)

Deeper template documentation: [docs/TEMPLATE-README.md](./docs/TEMPLATE-README.md).
