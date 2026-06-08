"use client";

import { useCallback, useEffect, useState } from "react";
import {
  connectHashPack,
  disconnectHashPack,
  getConnectedHederaAccountIds,
  getDAppConnector,
} from "~~/services/x402/hederaWalletConnect";

/** React hook for HashPack / Hedera WalletConnect session state. */
export function useHederaWalletConnect() {
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const connector = await getDAppConnector();
      setAccountIds(getConnectedHederaAccountIds(connector));
      setReady(true);
    } catch {
      setAccountIds([]);
      setReady(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const ids = await connectHashPack();
      setAccountIds(ids);
      return ids;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectHashPack();
    setAccountIds([]);
  }, []);

  return {
    accountIds,
    connecting,
    ready,
    connect,
    disconnect,
    refresh,
    isConnected: accountIds.length > 0,
  };
}
