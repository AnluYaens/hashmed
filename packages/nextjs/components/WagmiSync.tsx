"use client";

import { useEffect } from "react";
import { reconnect } from "wagmi/actions";
import { useAccount } from "wagmi";
import { ensureProvidersInitialized } from "~~/services/web3/appKitHedera";
import { useHederaWalletConnect } from "~~/services/web3/hederaWalletConnect";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";

/** Sync wagmi with the AppKit WalletConnect session after HashPack connects. */
export function WagmiSync() {
  const { isConnected: hederaConnected, hasEvmSession, provider } = useHederaWalletConnect();
  const { isConnected: wagmiConnected } = useAccount();

  useEffect(() => {
    if (!hederaConnected || wagmiConnected || !hasEvmSession || !provider) return;
    ensureProvidersInitialized(provider);
    void reconnect(wagmiConfig);
  }, [hederaConnected, wagmiConnected, hasEvmSession, provider]);

  return null;
}
