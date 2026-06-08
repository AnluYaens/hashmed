# x402 Pay-Per-Use Template — Test Runbook

A step-by-step guide to verifying each part of the template. Sections are added as each
iteration lands. Run commands from the repository root unless stated otherwise.

> Status: Iterations 1 (smart contract), 2 (local infra), and 3 (server: storage + x402 API
> routes) are implemented and testable below. Iterations 4–5 will be appended as they are built.

## Prerequisites

| Tool | Version | Needed for |
| --- | --- | --- |
| Node.js | >= 20.18.3 | everything |
| Yarn | 3.2.3 (via corepack) | monorepo scripts |
| Docker + Docker Compose | recent | Iteration 2 (MinIO + facilitator) |
| A funded **ECDSA** Hedera testnet account | — | deploying contracts + running the facilitator |

Get a testnet account and HBAR from the [Hedera Portal](https://portal.hedera.com/) faucet.
Create the account as **ECDSA** (x402 on Hedera requires ECDSA keys).

---

## Iteration 1 — Smart contract (`FileRegistry`)

The registry is pure EVM (no HTS/HSS precompiles), so it compiles and tests **offline** with
no Hedera fork.

### 1.1 Compile

```bash
yarn hardhat:compile
```

Expected: `Compiled 1 Solidity file successfully` and TypeChain typings generated.

### 1.2 Run the unit tests

```bash
yarn hardhat:test
```

Expected: **22 passing**, covering registration, metadata, deterministic file ids, price /
visibility / payTo updates, access control (owner-only), empty-value reverts, not-found
reverts, and pagination edge cases. A gas report prints at the end.

### 1.3 (Optional) Deploy to Hedera testnet

This regenerates `packages/nextjs/contracts/deployedContracts.ts` with the live address.

```bash
# One-time: create or import a funded deployer key
yarn hardhat:account:generate        # or: yarn hardhat:account:import
# Fund the printed account with testnet HBAR, then:
yarn hardhat:deploy --network hederaTestnet
```

Expected:
- `deploying "FileRegistry" ... deployed at 0x...`
- `📝 Updated TypeScript contract definition file on ../nextjs/contracts/deployedContracts.ts`
- A `296: { FileRegistry: { address, abi, ... } }` entry now exists in `deployedContracts.ts`.
- View it on HashScan: `https://hashscan.io/testnet/contract/0x...`

---

## Iteration 2 — Local infrastructure (MinIO + facilitator)

Two pieces run locally via Docker: a private **MinIO** bucket (object storage, no AWS) and the
**self-hosted x402 Hedera facilitator** (verify/settle, no third-party service).

### 2.1 Configure

```bash
cp .env.example .env
```

Edit `.env` and set the facilitator fee-payer (an ECDSA account funded with testnet HBAR):

```dotenv
FACILITATOR_ACCOUNT_ID=0.0.xxxxxx
FACILITATOR_PRIVATE_KEY=0x...
# MINIO_ROOT_USER / MINIO_ROOT_PASSWORD / S3_BUCKET can stay at defaults for local dev
```

### 2.2 Start the stack

```bash
yarn infra:up
```

Expected: `minio`, `minio-init`, and `facilitator` containers start. `minio-init` logs
`MinIO ready: private bucket x402-files created` then exits 0.

### 2.3 Verify MinIO

- Open the console at `http://localhost:9001` and log in with `MINIO_ROOT_USER` /
  `MINIO_ROOT_PASSWORD` (default `minioadmin` / `minioadmin`).
- Confirm the bucket (default `x402-files`) exists and its access policy is **private**
  (anonymous access disabled).

### 2.4 Verify the facilitator

```bash
curl -s localhost:4020/health
curl -s localhost:4020/supported
```

Expected `/health`:

```json
{ "status": "ok", "network": "hedera:testnet", "feePayer": "0.0.xxxxxx" }
```

Expected `/supported` (note the advertised `feePayer` and signer match your account):

```json
{
  "kinds": [{ "x402Version": 2, "scheme": "exact", "network": "hedera:testnet", "extra": { "feePayer": "0.0.xxxxxx" } }],
  "extensions": [],
  "signers": { "hedera:*": ["0.0.xxxxxx"] }
}
```

An unknown route returns HTTP `404`.

### 2.5 Logs / teardown

```bash
yarn infra:logs    # follow container logs
yarn infra:down    # stop the stack (MinIO data persists in the named volume)
```

### 2.6 (Optional) Test the facilitator without Docker

```bash
cd facilitator
cp .env.example .env   # set FACILITATOR_ACCOUNT_ID / FACILITATOR_PRIVATE_KEY
npm install
npm run check-types    # type-checks against @x402/core + @x402/hedera
npm start              # serves on :4020 — test with the curl commands in 2.4
```

---

## Iteration 3 — Server: storage helper + x402 API routes

The Next.js app is now the **x402 resource server**. It exposes two API routes:

- `POST /api/files/upload` — returns a presigned MinIO PUT URL (bytes never touch the server).
- `GET /api/files/:id/download` — reads the `FileRegistry`, serves public files for free, and
  gates private files behind a per-download HBAR payment (verify → settle → presigned GET URL).

These steps test the routes directly with `curl`. The full browser/agent payment loop lands in
Iteration 4; here we confirm uploads work and that a private file produces a well-formed `402`.

### 3.1 Prerequisites for this iteration

1. `FileRegistry` deployed and `deployedContracts.ts` populated (Iteration 1.3), **or** set
   `FILE_REGISTRY_ADDRESS` in `packages/nextjs/.env`.
2. The infra stack running (`yarn infra:up`) so MinIO (`:9000`) and the facilitator (`:4020`)
   are reachable.
3. Next.js env configured:

```bash
cp packages/nextjs/.env.example packages/nextjs/.env
# Defaults (localhost MinIO + facilitator, testnet RPC) work out of the box for local dev.
```

### 3.2 Start the app

```bash
yarn next:dev       # Next.js dev server on http://localhost:3000
```

### 3.3 Request an upload URL and PUT a file

```bash
# 1) Ask the server for a presigned upload URL
RESP=$(curl -s -X POST localhost:3000/api/files/upload \
  -H 'content-type: application/json' \
  -d '{"name":"hello.txt","mimeType":"text/plain"}')
echo "$RESP"
# => {"objectKey":"2026-06-05/<uuid>-hello.txt","uploadUrl":"http://localhost:9000/...","contentType":"text/plain","expiresIn":300}

# 2) Upload the bytes straight to MinIO with the returned URL
URL=$(echo "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin)["uploadUrl"])')
echo "hello x402" > /tmp/hello.txt
curl -s -X PUT "$URL" -H 'content-type: text/plain' --data-binary @/tmp/hello.txt -o /dev/null -w '%{http_code}\n'
# => 200
```

The object now exists in the private bucket. In a real flow the browser next calls
`FileRegistry.registerFile(objectKey, payToAccountId, priceTinybar, isPublic, ...)`; you can do
that from the **Debug Contracts** page once the UI lands, or via `cast`/Hardhat console.

### 3.4 Public download returns `200` + a presigned URL

For a file registered with `isPublic = true`:

```bash
curl -s "localhost:3000/api/files/<fileId>/download"
# => {"url":"http://localhost:9000/x402-files/...<signed>","file":{...,"isPublic":true}}
```

Following `url` downloads the bytes. No payment header is involved.

### 3.5 Private download returns a well-formed `402`

For a file registered with `isPublic = false` and a non-zero `priceTinybar`, calling without a
payment header returns the x402 challenge:

```bash
curl -s -i "localhost:3000/api/files/<fileId>/download"
```

Expected:
- Status `402 Payment Required`.
- A `PAYMENT-REQUIRED` response header (base64 challenge for x402 clients).
- JSON body whose `accepts[0]` advertises `scheme: "exact"`, `network: "hedera:testnet"`,
  `payTo` = the file's account id, the price in tinybars, and `extra.feePayer` from the
  facilitator.

Sanity checks:
- Unknown / malformed id → `400`.
- Unregistered id → `404`.
- Registry not deployed → `503` with a clear message.
- Facilitator down → `502`.

> Completing the payment (signing, retrying with `PAYMENT-SIGNATURE`, then receiving a
> `200` + `PAYMENT-RESPONSE` receipt and the presigned URL) is exercised end-to-end in
> Iteration 4 with the burner-wallet client and the Node agent buyer script.

## Iteration 4 — Client + UI

End-to-end pay-per-download on testnet via HashPack (WalletConnect), the burner wallet, or the
Node agent script.

### Prerequisites

- Iterations 1–3 complete (registry deployed, MinIO + facilitator running, `yarn next:dev` up).
- `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` set in `packages/nextjs/.env` (reused for HashPack).
- `NEXT_PUBLIC_X402_NETWORK=hedera:testnet` matches `X402_NETWORK`.
- HashPack mobile app on the same Hedera testnet, funded with testnet HBAR.

### A — Pay with HashPack (browser)

1. Open a **private** file at `/files/<id>`.
2. Click **Connect HashPack to pay** and approve the WalletConnect session in HashPack.
3. Click **Pay … HBAR & download** — HashPack prompts to sign the native HBAR transfer.
4. After settlement you should get a presigned download URL and a tx receipt on the page.

### B — Pay with Burner Wallet (local dev)

1. Connect via RainbowKit → **Development → Burner Wallet**.
2. Fund the burner’s Hedera account (faucet) if needed.
3. Pay & download on a private file — signing uses the burner key in localStorage.

### C — Pay from the Node agent

```bash
RESOURCE_URL="http://localhost:3000/api/files/<fileId>/download" \
  BUYER_ACCOUNT_ID=0.0.xxxx BUYER_PRIVATE_KEY=0x... \
  yarn x402:buy
```

Expect `200` with a presigned URL and `PAYMENT-RESPONSE` settlement metadata.

## Iteration 5 — Packaging

_To be added when implemented. Will cover: scaffolding the template via the CLI and the
post-scaffold setup steps._
