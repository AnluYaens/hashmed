import type { DAppConnector } from "@hashgraph/hedera-wallet-connect/dist/lib/dapp";
import scaffoldConfig from "~~/scaffold.config";
import { X402_CLIENT_NETWORK } from "~~/services/x402/client";

let connectorInstance: DAppConnector | null = null;
let connectorPromise: Promise<DAppConnector> | null = null;

function assertBrowser(): void {
  if (typeof window === "undefined") {
    throw new Error("HashPack connection is only available in the browser.");
  }
}

/** Hedera account ids (`0.0.x`) from active WalletConnect signers. */
export function getConnectedHederaAccountIds(connector: DAppConnector): string[] {
  return connector.signers.map(signer => signer.getAccountId().toString());
}

/**
 * Lazily initialize the Hedera WalletConnect `DAppConnector` (HashPack, Blade, etc.).
 * Heavy deps are loaded on first use so they stay out of the initial bundle.
 */
export async function getDAppConnector(): Promise<DAppConnector> {
  assertBrowser();
  if (connectorInstance) return connectorInstance;
  if (!connectorPromise) {
    connectorPromise = initDAppConnector();
  }
  return connectorPromise;
}

async function initDAppConnector(): Promise<DAppConnector> {
  const [{ DAppConnector }, { HederaChainId, HederaJsonRpcMethod, HederaSessionEvent }, { LedgerId }] =
    await Promise.all([
      import("@hashgraph/hedera-wallet-connect/dist/lib/dapp"),
      import("@hashgraph/hedera-wallet-connect/dist/lib/shared"),
      import("@hiero-ledger/sdk"),
    ]);

  const isMainnet = X402_CLIENT_NETWORK.endsWith("mainnet");
  const origin = window.location.origin;

  const connector = new DAppConnector(
    {
      name: "scaffold-hbar",
      description: "x402 pay-per-use file marketplace",
      url: origin,
      icons: [`${origin}/logo.svg`],
    },
    isMainnet ? LedgerId.MAINNET : LedgerId.TESTNET,
    scaffoldConfig.walletConnectProjectId,
    Object.values(HederaJsonRpcMethod),
    [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
    isMainnet ? [HederaChainId.Mainnet] : [HederaChainId.Testnet, HederaChainId.Mainnet],
  );

  await connector.init({ logger: "error" });
  connectorInstance = connector;
  return connector;
}

/** Open the WalletConnect modal and return connected Hedera account ids. */
export async function connectHashPack(): Promise<string[]> {
  const connector = await getDAppConnector();
  await connector.openModal();
  return getConnectedHederaAccountIds(connector);
}

/** Disconnect all active WalletConnect sessions. */
export async function disconnectHashPack(): Promise<void> {
  if (!connectorInstance) return;
  await connectorInstance.disconnectAll();
  connectorInstance = null;
  connectorPromise = null;
}
