import * as chains from "viem/chains";

/**
 * HashScan links for native Hedera transactions.
 *
 * x402 settlements return a native transaction id (`0.0.x@seconds.nanos`), not an
 * EVM hash — so `getBlockExplorerTxLink` in `networks.ts` does not apply here.
 */

/** Networks with a HashScan deployment. Anything else (e.g. the local fork) has none. */
const HASHSCAN_NETWORK_BY_CHAIN_ID: Record<number, "mainnet" | "testnet"> = {
  [chains.hedera.id]: "mainnet",
  [chains.hederaTestnet.id]: "testnet",
};

const TRANSACTION_ID_RE = /^(\d+\.\d+\.\d+)@(\d+)(?:\.(\d+))?$/;

/**
 * Convert a native Hedera transaction id into the dashed path used by HashScan
 * and the mirror node: `0.0.9841920@1785413554.921013104` becomes
 * `0.0.9841920-1785413554-921013104`.
 *
 * @returns The dashed path, or `null` when the id is missing or malformed.
 */
export function toHederaTransactionPath(transactionId: string | null | undefined): string | null {
  const match = TRANSACTION_ID_RE.exec(transactionId?.trim() ?? "");
  if (!match) return null;

  const [, account, seconds, nanos = "0"] = match;
  return `${account}-${seconds}-${nanos}`;
}

/**
 * HashScan URL for a native Hedera transaction id.
 *
 * Never throws — it renders in the payment success path, where a malformed id must
 * degrade to "no link" rather than take the page down.
 *
 * @param transactionId - Native transaction id, e.g. `0.0.9841920@1785413554.921013104`.
 * @param chainId - Chain the transaction settled on.
 * @returns The URL, or `null` when the id is unusable or the chain has no HashScan.
 */
export function getHashScanTransactionLink(transactionId: string | null | undefined, chainId: number): string | null {
  const network = HASHSCAN_NETWORK_BY_CHAIN_ID[chainId];
  if (!network) return null;

  const path = toHederaTransactionPath(transactionId);
  return path ? `https://hashscan.io/${network}/transaction/${path}` : null;
}
