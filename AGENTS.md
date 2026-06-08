# [AGENTS.md](http://AGENTS.md)

Guidance for coding agents working in the **x402 pay-per-use** Scaffold-HBAR template.

## Project overview

Hardhat-only monorepo (no Foundry package):

- **`packages/hardhat`** — `FileRegistry.sol`, deploy scripts, tests
- **`packages/nextjs`** — Next.js resource server (`/api/files/*`), marketplace UI, x402 client (HashPack)
- **`facilitator/`** — self-hosted x402 Hedera facilitator (verify / settle)
- **`docker-compose.yml`** — MinIO + facilitator for local dev

Payments settle on Hedera **testnet** via native HBAR transfers. MinIO and the facilitator run locally.

## Common commands

```bash
# Local infra (MinIO + facilitator)
yarn infra:up
yarn infra:down
yarn infra:logs

# Contracts (Hardhat)
yarn hardhat:account:generate
yarn hardhat:deploy --network hederaTestnet
yarn hardhat:verify:testnet
yarn hardhat:test

# App
yarn next:dev
yarn next:build

# x402 agent buyer (Node script)
yarn x402:buy

# Quality
yarn lint
yarn format
```

## Architecture notes

### x402 flow

1. Upload → presigned MinIO PUT + `FileRegistry.registerFile`
2. Public download → `200` + presigned GET URL
3. Private download → `402` → HashPack partial sign → facilitator `/settle` → `200` + presigned URL

The Next.js app never holds the facilitator private key. See README.md § “Why the facilitator needs a private key”.

### Frontend contract hooks

- `useScaffoldReadContract` — NOT ~~useScaffoldContractRead~~
- `useScaffoldWriteContract` — NOT ~~useScaffoldContractWrite~~
- `useScaffoldEventHistory` — marketplace listing from `FileRegistered`

After `yarn hardhat:deploy`, ABIs land in `packages/nextjs/contracts/deployedContracts.ts` — do not hand-edit.

### Key paths

| Area | Path |
| --- | --- |
| x402 resource server | `packages/nextjs/services/x402/server.ts` |
| x402 browser client | `packages/nextjs/services/x402/client.ts` |
| HashPack signer | `packages/nextjs/services/x402/walletSigner.ts` |
| MinIO helper | `packages/nextjs/services/storage/client.ts` |
| Upload / download routes | `packages/nextjs/app/api/files/` |
| Marketplace UI | `packages/nextjs/app/files/` |

## Packaging

Template manifest: `template.json` (branch `templates/x402-pay-per-use`). See RUNBOOK.md § Iteration 5.
