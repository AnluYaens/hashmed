# HashMed — Phased Prompts for AI Coding Agents

How to use: paste ONE phase's prompt at a time into Cursor or OpenAI Codex. Use Claude
for architecture/review, Cursor/Codex for execution. Do not skip acceptance criteria.
If a verification command fails, STOP and fix before moving on.

Global rule for every phase: before editing, run the existing tests and record the
baseline. After editing, run them again — they must still pass. Small commits.
Never commit `.env` or keys. Read `RUNBOOK.md` first.

---

## Phase 0 — Environment setup & smoke test

Goal: the template installs and boots locally with ZERO code changes.

Prompt:
"Read RUNBOOK.md and README.md in this repo root first, and follow them exactly.
Confirm Node is 20 LTS and the repo's pinned Yarn 3 is active. Run the install command
from the RUNBOOK (expected `yarn install`). Bring up the Docker services per the
RUNBOOK (MinIO and the facilitator via docker-compose). Start the Next.js app (expected
`yarn next:dev` or `yarn next:start`). Do NOT change any code. Report the exact commands
you ran, their output, and the local URLs (app expected at http://localhost:3000, MinIO
console at http://localhost:9001). If any command differs from what I said, trust the
RUNBOOK and tell me the difference."

Definition of done: app loads at localhost:3000; MinIO console reachable; facilitator
container running; no source files changed.
Verification commands: `node -v` (v20.x); `yarn hardhat:test` (baseline — record pass
count, expect ~22); `docker compose ps` (services up).
Do NOT: edit Solidity, put env secrets into git, reskin anything, upgrade dependencies.

---

## Phase 1 — End-to-end payment on testnet

Goal: one real x402 payment settles on Hedera testnet with a HashScan link, template
unchanged.

Prompt:
"Goal: complete one real end-to-end pay-per-read on Hedera testnet with the template
UNCHANGED. Steps: (1) Confirm `.env` has a FUNDED ECDSA testnet account for the
facilitator (FACILITATOR_ACCOUNT_ID, FACILITATOR_PRIVATE_KEY) and
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID — verify these names against `.env.example` and
do NOT print secret values. (2) Deploy the FileRegistry contract to Hedera testnet using
the RUNBOOK's deploy command (expected `yarn hardhat:deploy --network hederaTestnet` —
confirm the exact network key in the Hardhat config). (3) In the UI, upload a sample PDF
with a micro-price, connect HashPack (native `hedera` namespace), request the file, hit
HTTP 402, pay, and confirm the download unlocks. (4) Copy the Hedera transaction ID and
give me the HashScan link as https://hashscan.io/testnet/tx/<transactionId>. Report every
command and the HashScan URL. If the ECDSA account is not funded you may see a 'Sender
account not found'-type failure — stop and tell me."

Definition of done: 402 → pay → settle → download works; a real testnet transaction
exists; HashScan link saved.
Verification commands: open the HashScan link and confirm status SUCCESS; re-run
`yarn hardhat:test` (still passing).
Do NOT: modify the contract; switch to ED25519; refactor the payment flow; change the
facilitator co-signing logic.

---

## Phase 2 — Medical domain reskin & metadata

Goal: the app reads/feels like a medical lab-results marketplace, with ZERO contract
changes.

Prompt:
"Reskin the Next.js app ONLY (`packages/nextjs`) into 'HashMed', a pay-per-read medical
lab-results marketplace. Do NOT touch `packages/hardhat` or the Solidity contract, and do
not redeploy. Map the existing file/listing concept to medical reports: a 'lab' lists a
'lab report' (PDF) with a micro-price; a 'clinic/patient' pays ~$0.001 HBAR to unlock one
read. Add medical metadata (e.g. report type, specimen date, lab name, patient pseudonym)
purely in the UI/metadata layer — synthetic data only, clearly fake. Keep using the
existing on-chain getFileCount()/getFiles() view calls for the listing; do NOT switch to
event logs. Update copy, labels, and sample data. After changes, run `yarn hardhat:test`
and confirm all tests still pass (nothing in hardhat should have changed). Show me a diff
limited to packages/nextjs."

Definition of done: UI presents medical listings and the pay-per-read flow using
synthetic data; contract and tests untouched; diff confined to `packages/nextjs`.
Verification commands: `yarn hardhat:test` (unchanged pass count);
`git diff --stat` shows only `packages/nextjs` (and docs) touched.
Do NOT: edit `packages/hardhat`; introduce real patient data; change payment/facilitator
logic; alter the read strategy.

---

## Phase 3 — UI polish

Goal: a clean, judge-legible UI that makes the "wow" moment (a real on-chain
micropayment) obvious in seconds.

Prompt:
"Polish the HashMed UI in `packages/nextjs` ONLY. Priorities: (1) a clear landing that
states the use case in one line; (2) an obvious pay-per-read flow where the 402 → pay →
unlock steps are visible; (3) after payment, surface the HashScan link for that
transaction directly in the UI. Keep it simple and fast — no new heavy dependencies. Do
NOT change contract, payment, or facilitator logic. Run `yarn hardhat:test` after and
confirm still green."

Definition of done: flow is self-explanatory; HashScan link surfaced in-app; tests green;
no scope creep.
Verification commands: `yarn hardhat:test`; manual click-through of the full flow.
Do NOT: add auth/accounts/subscriptions; add unrelated features; touch hardhat.

---

## Phase 4 — README-as-pitch + demo prep

Goal: a judge understands HashMed in 30 seconds and can verify a real payment in one
click.

Prompt:
"Write README.md as a pitch for hackathon judges, in English. Structure: (1) one-line
what-it-is and who-it's-for; (2) HashScan link(s) to real testnet payments UP TOP; (3) a
simple architecture diagram (lab → 402 → HashPack pay → facilitator co-signs/submits →
Hedera testnet → short-lived download); (4) how it uses Hedera rails and x402; (5)
quickstart to run locally (pull EXACT commands from RUNBOOK.md — don't invent them); (6)
an explicit note that only synthetic data is used and the Solidity contract is unmodified
from the template. Keep it tight. Then write a demo script under 5 minutes: 0:00 hook +
one-line pitch, then the live flow (upload → request → 402 → HashPack pay → settle →
HashScan SUCCESS → download), ending on the HashScan proof. Do NOT narrate architecture
over slides — show the product doing the thing."

Definition of done: README leads with use case + HashScan links + diagram; demo script
≤5 min and product-first.
Verification commands: every command in the README actually runs; every HashScan link
resolves to SUCCESS.
Do NOT: invent commands, stats, or metrics; pad the video with slideware.

---

## Phase 5 — Submission checklist

Goal: submit with buffer, nothing missing.

Prompt:
"Produce a final submission checklist and verify each item: (1) public open-source GitHub
repo (license present, no secrets in history — grep for keys, confirm `.env` is
gitignored); (2) real Hedera testnet transactions with working HashScan links in the
README; (3) demo video under 5 minutes uploaded and linked; (4) submission-form fields
drafted in English matching the bounty page's required fields; (5) `yarn hardhat:test`
passes on a clean clone. Report anything missing. Do NOT add new features."

Definition of done: all five verified; submitted ≥30 minutes before the deadline.
Verification commands: fresh `git clone` → `yarn install` → `yarn hardhat:test`; open each
HashScan link; play the video and time it.
Do NOT: commit secrets; add last-minute features; wait until 11:58 PM.
