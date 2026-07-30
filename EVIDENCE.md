# HashMed — On-Chain Evidence (Hedera Testnet)

Proof of real x402 payments settling on Hedera testnet. All transactions below are live and verifiable on HashScan.

## Deployed contract

- **FileRegistry** — [`0.0.9841647`](https://hashscan.io/testnet/contract/0.0.9841647)

## Settled x402 payments

| #   | Description                                                                                                                                          | Transaction                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | First end-to-end pay-per-read: buyer paid 1 HBAR via HTTP 402 → facilitator co-signed and settled → download unlocked                                | [`1785413554.921013104`](https://hashscan.io/testnet/transaction/1785413554.921013104) |
| 2   | Pay-per-read of a synthetic CBC report (0.001 HBAR) through the HashMed UI                                                                           | [`1785416899.380741104`](https://hashscan.io/testnet/transaction/1785416899.380741104) |
| 3   | Agent-initiated payment: the bundled `yarn x402:buy` Node script paid 0.001 HBAR and downloaded the report machine-to-machine — no browser, no human | [`1785432372.855648259`](https://hashscan.io/testnet/transaction/1785432372.855648259) |

## Accounts (roles)

| Role                                          | Account                                                          |
| --------------------------------------------- | ---------------------------------------------------------------- |
| Buyer (HashPack wallet)                       | [`0.0.9489233`](https://hashscan.io/testnet/account/0.0.9489233) |
| Payout — the "lab" receiving payments         | [`0.0.9842118`](https://hashscan.io/testnet/account/0.0.9842118) |
| Facilitator (fee payer, co-signs settlements) | [`0.0.9841920`](https://hashscan.io/testnet/account/0.0.9841920) |

---

_New settlement links from the demo recording will be appended here._
