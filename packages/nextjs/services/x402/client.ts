import type { ClientHederaSigner } from "@x402/hedera";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Browser-side x402 payment client for private downloads.
 *
 * Supports:
 * - **HashPack** (and other Hedera wallets) via WalletConnect `hedera_signTransaction`
 * - **Burner Wallet** for local dev (private key in localStorage)
 * - **Node agent** (`yarn x402:buy`) for machine-to-machine use
 *
 * Heavy dependencies are loaded with dynamic `import()` when a user actually pays.
 */

/** CAIP-2 network the client signs for; must match the resource server. */
export const X402_CLIENT_NETWORK = process.env.NEXT_PUBLIC_X402_NETWORK ?? "hedera:testnet";

/** localStorage key the Burner Wallet uses to persist its private key. */
const BURNER_PK_STORAGE_KEY = "burnerWallet.pk";

/** Which in-browser signer to use for x402 payment. */
export type PaymentSignerMode = "auto" | "hashpack" | "burner";

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
 */
async function resolveHederaAccountId(evmAddress: string): Promise<string | null> {
  const network = shortNetwork(X402_CLIENT_NETWORK);
  const res = await fetch(`/api/hedera/account?evm=${evmAddress}&network=${network}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { accountId?: string | null };
  return data.accountId ?? null;
}

async function buildHttpClient(signer: ClientHederaSigner) {
  const [clientScheme, core] = await Promise.all([import("@x402/hedera/exact/client"), import("@x402/core/client")]);
  const scheme = new clientScheme.ExactHederaScheme(signer);
  const x402Client = new core.x402Client().register(X402_CLIENT_NETWORK as never, scheme);
  return new core.x402HTTPClient(x402Client);
}

async function buildBurnerSigner(privateKeyHex: Hex): Promise<ClientHederaSigner> {
  const [{ PrivateKey }, { createClientHederaSigner }] = await Promise.all([
    import("@hiero-ledger/sdk"),
    import("@x402/hedera"),
  ]);

  const signerAddress = privateKeyToAccount(privateKeyHex).address;
  const accountId = await resolveHederaAccountId(signerAddress);
  if (!accountId) {
    throw new Error(
      "The Burner Wallet address has no Hedera account yet. Fund it with testnet HBAR (faucet) before paying.",
    );
  }

  const privateKey = PrivateKey.fromStringECDSA(privateKeyHex);
  return createClientHederaSigner(accountId, privateKey, { network: X402_CLIENT_NETWORK });
}

async function buildHashPackSigner(): Promise<ClientHederaSigner> {
  const [{ getConnectedHederaAccountIds, getDAppConnector }, { createWalletHederaSigner }] = await Promise.all([
    import("~~/services/x402/hederaWalletConnect"),
    import("~~/services/x402/walletSigner"),
  ]);

  const connector = await getDAppConnector();
  const accountIds = getConnectedHederaAccountIds(connector);
  if (accountIds.length === 0) {
    throw new Error("Connect HashPack first to pay in-browser.");
  }

  return createWalletHederaSigner(accountIds[0], connector, { network: X402_CLIENT_NETWORK });
}

async function resolvePaymentSigner(mode: PaymentSignerMode): Promise<ClientHederaSigner> {
  if (mode === "hashpack") {
    return buildHashPackSigner();
  }

  if (mode === "burner") {
    const privateKeyHex = getBurnerPrivateKey();
    if (!privateKeyHex) {
      throw new Error("In-app payment requires the Burner Wallet or HashPack.");
    }
    return buildBurnerSigner(privateKeyHex);
  }

  // auto: prefer HashPack when a WC session exists, otherwise burner
  try {
    const { getConnectedHederaAccountIds, getDAppConnector } = await import("~~/services/x402/hederaWalletConnect");
    const connector = await getDAppConnector();
    if (getConnectedHederaAccountIds(connector).length > 0) {
      return buildHashPackSigner();
    }
  } catch {
    // WalletConnect not initialized yet — fall through to burner
  }

  const privateKeyHex = getBurnerPrivateKey();
  if (!privateKeyHex) {
    throw new Error("Connect HashPack or switch to the Burner Wallet to pay in-browser.");
  }
  return buildBurnerSigner(privateKeyHex);
}

/**
 * Pay for and resolve the presigned download URL of a private file.
 *
 * Implements the x402 retry loop: request the resource, read the `402`
 * challenge, sign the HBAR transfer, retry with the `PAYMENT-SIGNATURE` header,
 * and return the URL once settlement succeeds.
 */
export async function payAndGetDownloadUrl(params: {
  resourceUrl: string;
  signer?: PaymentSignerMode;
}): Promise<PaidDownload> {
  const signer = await resolvePaymentSigner(params.signer ?? "auto");
  const httpClient = await buildHttpClient(signer);

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

  const challengeBody = await first
    .clone()
    .json()
    .catch(() => undefined);
  const paymentRequired = httpClient.getPaymentRequiredResponse(name => first.headers.get(name), challengeBody);
  const payload = await httpClient.createPaymentPayload(paymentRequired);
  const paymentHeaders = httpClient.encodePaymentSignatureHeader(payload);

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
    case "payment_required": {
      const reason = (result.paymentRequired as { error?: string })?.error ?? "Payment was rejected by the server";
      throw new Error(reason);
    }
    case "error": {
      const body = result.body as { error?: string };
      throw new Error(body?.error ?? `Download failed with status ${result.status}`);
    }
    default:
      throw new Error("Unexpected response from server");
  }
}
