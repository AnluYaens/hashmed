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

1. Upload → presigned MinIO PUT + native `FileRegistry.registerFile` via HashPack (`ContractExecuteTransaction`)
2. Marketplace listing → on-chain `getFileCount` + `getFiles` (not `eth_getLogs` — Hedera RPC 7-day log window)
3. Public download → `200` + presigned GET URL
4. Private download → `402` → HashPack partial sign (`TransferTransaction`) → facilitator `/settle` → `200` + presigned URL

The Next.js app never holds the facilitator private key. See README.md § “Why the facilitator needs a private key”.

### HashPack / wallet integration

- Reown AppKit uses **only** the `hedera` namespace (`HederaAdapter` in `appKitHedera.ts`) — no `eip155` wagmi signing path for this template’s upload/payment flows.
- Registry writes: `writeContractViaNativeProvider` → `hedera_signAndExecuteTransaction`
- x402 payments: `createHederaProviderSigner` → `hedera_signTransaction` (partial sign; facilitator co-signs as fee payer)
- Deploy stores both `address` (EVM `0x…`) and `hederaContractId` (`0.0.x`) in `deployedContracts.ts`. Native contract executes must use the Hedera id — `ContractId.fromSolidityAddress` is wrong for JSON-RPC-deployed contracts.

### Frontend hooks (this template)

- `useRegistryFileListing` — marketplace file list via `getFiles` pagination
- `writeContractViaNativeProvider` — upload / owner actions (not `useScaffoldWriteContract`)
- `useScaffoldReadContract` — NOT ~~useScaffoldContractRead~~
- `useScaffoldWriteContract` — available from scaffold-hbar but **not used** by the x402 marketplace UI
- `useScaffoldEventHistory` — avoid on Hedera testnet/mainnet (7-day `eth_getLogs` limit); use `getFiles` or an indexer instead

After `yarn hardhat:deploy`, ABIs and addresses land in `packages/nextjs/contracts/deployedContracts.ts` — do not hand-edit (regenerated on deploy).

### Key paths

| Area | Path |
| --- | --- |
| x402 resource server | `packages/nextjs/services/x402/server.ts` |
| x402 browser client | `packages/nextjs/services/x402/client.ts` |
| HashPack x402 signer | `packages/nextjs/services/x402/walletSigner.ts` |
| Native contract writes | `packages/nextjs/services/web3/hederaContractWrite.ts` |
| Hedera contract id resolution | `packages/nextjs/utils/scaffold-hbar/hederaContractId.ts` |
| Marketplace listing hook | `packages/nextjs/hooks/scaffold-hbar/useRegistryFileListing.ts` |
| MinIO helper | `packages/nextjs/services/storage/client.ts` |
| On-chain registry reads (server) | `packages/nextjs/services/registry/server.ts` |
| Upload / download routes | `packages/nextjs/app/api/files/` |
| Marketplace UI | `packages/nextjs/app/files/` |

## Packaging

Template manifest: `template.json` (branch `templates/x402-pay-per-use`). See RUNBOOK.md § Iteration 5.
