import type { Hex } from "viem";

/**
 * Browser-side x402 payment client for private downloads.
 *
 * Paying for a private file means signing a Hedera HBAR transfer. That requires
 * the payer's Hedera private key, which we can only read for the in-browser
 * **Burner Wallet** (injected wallets like HashPack/MetaMask never expose their
 * key). For those, or for machine-to-machine use, drive the same endpoint with
 * the Node agent script (`yarn x402:buy`).
 *
 * Heavy dependencies (the Hedera SDK and the x402 client libs) are loaded with
 * dynamic `import()` so they are code-split out of the initial bundle and only
 * fetched when a user actually pays.
 */

/** CAIP-2 network the client signs for; must match the resource server. */
export const X402_CLIENT_NETWORK = process.env.NEXT_PUBLIC_X402_NETWORK ?? "hedera:testnet";

/** localStorage key the Burner Wallet uses to persist its private key. */
const BURNER_PK_STORAGE_KEY = "burnerWallet.pk";

/** Outcome of a paid download attempt. */
export type PaidDownload = {
  url: string;
  transaction?: string;
  payer?: string;
};

/**
 * Read the Burner Wallet private key from local storage.
 *
 * @returns The `0x`-prefixed ECDSA key, or `null` when no burner key is present.
 */
export function getBurnerPrivateKey(): Hex | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(BURNER_PK_STORAGE_KEY)?.replaceAll('"', "");
  if (!raw) return null;
  if (raw.length === 64) return `0x${raw}` as Hex;
  if (raw.length === 66 && raw.startsWith("0x")) return raw as Hex;
  return null;
}

/** Short network name (`testnet` / `mainnet`) parsed from a CAIP-2 id. */
function shortNetwork(caip2: string): "testnet" | "mainnet" {
  return caip2.endsWith("mainnet") ? "mainnet" : "testnet";
}

/**
 * Resolve the Hedera account id (`0.0.x`) for an EVM address via the mirror node.
 *
 * @param evmAddress - The connected wallet's EVM address.
 * @returns The Hedera account id, or `null` when the address has no account yet.
 */
async function resolveHederaAccountId(evmAddress: string): Promise<string | null> {
  const network = shortNetwork(X402_CLIENT_NETWORK);
  const res = await fetch(`/api/hedera/account?evm=${evmAddress}&network=${network}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { accountId?: string | null };
  return data.accountId ?? null;
}

/**
 * Build an x402 HTTP client whose `exact` Hedera scheme signs with the Burner
 * Wallet key for the given account.
 */
async function buildBurnerHttpClient(accountId: string, privateKeyHex: Hex) {
  const [{ PrivateKey }, { createClientHederaSigner }, clientScheme, core] = await Promise.all([
    import("@hiero-ledger/sdk"),
    import("@x402/hedera"),
    import("@x402/hedera/exact/client"),
    import("@x402/core/client"),
  ]);

  const privateKey = PrivateKey.fromStringECDSA(privateKeyHex);
  const signer = createClientHederaSigner(accountId, privateKey, { network: X402_CLIENT_NETWORK });
  const scheme = new clientScheme.ExactHederaScheme(signer);
  const x402Client = new core.x402Client().register(X402_CLIENT_NETWORK as never, scheme);
  return new core.x402HTTPClient(x402Client);
}

/**
 * Pay for and resolve the presigned download URL of a private file.
 *
 * Implements the x402 retry loop: request the resource, read the `402`
 * challenge, sign the HBAR transfer, retry with the `PAYMENT-SIGNATURE` header,
 * and return the URL once settlement succeeds.
 *
 * @param params.resourceUrl - The file's download endpoint.
 * @param params.evmAddress - The connected Burner Wallet's EVM address.
 * @returns The presigned URL plus the settlement transaction id.
 * @throws When no burner key is available, the address has no Hedera account,
 *   the server returns an error, or settlement fails.
 */
export async function payAndGetDownloadUrl(params: { resourceUrl: string; evmAddress: string }): Promise<PaidDownload> {
  const privateKeyHex = getBurnerPrivateKey();
  if (!privateKeyHex) {
    throw new Error("In-app payment requires the Burner Wallet. Use the agent script for other wallets.");
  }

  const accountId = await resolveHederaAccountId(params.evmAddress);
  if (!accountId) {
    throw new Error("This address has no Hedera account yet. Receive some testnet HBAR to it first.");
  }

  const httpClient = await buildBurnerHttpClient(accountId, privateKeyHex);

  // 1) First request — expect a 402 challenge (or a free public URL).
  const first = await fetch(params.resourceUrl);
  if (first.ok) {
    const body = (await first.json()) as { url?: string };
    if (!body.url) throw new Error("Server did not return a download URL");
    return { url: body.url };
  }
  if (first.status !== 402) {
    const body = await first.json().catch(() => ({}) as { error?: string });
    throw new Error(body?.error ?? `Request failed with status ${first.status}`);
  }

  // 2) Build and sign the payment from the challenge.
  const challengeBody = await first
    .clone()
    .json()
    .catch(() => undefined);
  const paymentRequired = httpClient.getPaymentRequiredResponse(name => first.headers.get(name), challengeBody);
  const payload = await httpClient.createPaymentPayload(paymentRequired);
  const paymentHeaders = httpClient.encodePaymentSignatureHeader(payload);

  // 3) Retry with the signed payment.
  const paid = await fetch(params.resourceUrl, { headers: paymentHeaders });
  const result = await httpClient.processResponse(paid);

  switch (result.kind) {
    case "success": {
      const body = result.body as { url?: string };
      if (!body?.url) throw new Error("Payment succeeded but no download URL was returned");
      return { url: body.url, transaction: result.settleResponse.transaction, payer: result.settleResponse.payer };
    }
    case "settle_failed":
      throw new Error(`Payment settlement failed: ${result.settleResponse.errorReason ?? "unknown"}`);
    case "payment_required":
      throw new Error("Payment was rejected by the server");
    case "error": {
      const body = result.body as { error?: string };
      throw new Error(body?.error ?? `Download failed with status ${result.status}`);
    }
    default:
      throw new Error("Unexpected response from server");
  }
}
