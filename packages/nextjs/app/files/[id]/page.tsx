"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { NextPage } from "next";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CommandLineIcon,
  LockClosedIcon,
  LockOpenIcon,
} from "@heroicons/react/24/outline";
import { HederaAddress } from "~~/components/scaffold-hbar";
import { FILE_REGISTRY_ABI, getFileRegistryAddress } from "~~/contracts/fileRegistryAbi";
import { useTargetNetwork } from "~~/hooks/scaffold-hbar";
import { useHederaWalletConnect } from "~~/hooks/x402/useHederaWalletConnect";
import { getBurnerPrivateKey, payAndGetDownloadUrl } from "~~/services/x402/client";
import { getParsedError, notification } from "~~/utils/scaffold-hbar";
import { formatTinybar, hbarToTinybar } from "~~/utils/x402";

type PublicFile = {
  fileId: string;
  name: string;
  mimeType: string;
  isPublic: boolean;
  priceTinybar: string;
  owner: string;
  payToAccountId: string;
  contentHash: string;
};

const FileDetail: NextPage = () => {
  const { id } = useParams<{ id: string }>();
  const { address, chain, connector } = useAccount();
  const { targetNetwork } = useTargetNetwork();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const BURNER_WALLET_CONNECTOR_ID = "burnerWallet";
  const isBurnerWallet = connector?.id === BURNER_WALLET_CONNECTOR_ID;
  const hashpack = useHederaWalletConnect();
  const canPayWithHashpack = hashpack.isConnected;
  const canPayWithBurner = isBurnerWallet && !!getBurnerPrivateKey();
  const canPay = canPayWithHashpack || canPayWithBurner;

  const [file, setFile] = useState<PublicFile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const registryAddress = getFileRegistryAddress(targetNetwork.id);
  const isOwner = !!address && !!file && address.toLowerCase() === file.owner.toLowerCase();
  const onWrongNetwork = !!chain && chain.id !== targetNetwork.id;

  const resourceUrl = useMemo(
    () => (typeof window !== "undefined" && id ? `${window.location.origin}/api/files/${id}/download` : ""),
    [id],
  );

  const load = useCallback(async () => {
    if (!id) return;
    setStatus("loading");
    try {
      const res = await fetch(`/api/files/${id}`);
      const data = (await res.json()) as { file?: PublicFile; error?: string };
      if (!res.ok || !data.file) {
        setMessage(data.error ?? "File not found");
        setStatus("error");
        return;
      }
      setFile(data.file);
      setStatus("ready");
    } catch {
      setMessage("Could not reach the server");
      setStatus("error");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const openUrl = (url: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    a.click();
  };

  const handleFreeDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(resourceUrl);
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Download failed");
      openUrl(data.url);
      notification.success("Download ready");
    } catch (e) {
      notification.error(getParsedError(e));
    } finally {
      setDownloading(false);
    }
  };

  const handlePaidDownload = async () => {
    if (!canPay) {
      notification.error("Connect HashPack or switch to the Burner Wallet to pay in-browser.");
      return;
    }
    setDownloading(true);
    setReceipt(null);
    const toastId = notification.loading("Signing x402 payment…");
    try {
      const result = await payAndGetDownloadUrl({
        resourceUrl,
        signer: canPayWithHashpack ? "hashpack" : "burner",
      });
      notification.remove(toastId);
      notification.success("Payment settled — download ready");
      if (result.transaction) setReceipt(result.transaction);
      openUrl(result.url);
    } catch (e) {
      notification.remove(toastId);
      notification.error(getParsedError(e));
    } finally {
      setDownloading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="w-full max-w-2xl mx-auto px-5 py-10">
        <div className="h-48 rounded-2xl bg-base-200 animate-pulse" />
      </div>
    );
  }

  if (status === "error" || !file) {
    return (
      <div className="w-full max-w-2xl mx-auto px-5 py-10">
        <Link href="/files" className="btn btn-ghost btn-sm gap-1 mb-6">
          <ArrowLeftIcon className="h-4 w-4" /> Marketplace
        </Link>
        <div className="alert alert-warning">
          <span>{message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-5 py-10">
      <Link href="/files" className="btn btn-ghost btn-sm gap-1 mb-6">
        <ArrowLeftIcon className="h-4 w-4" /> Marketplace
      </Link>

      <div className="bg-base-100 border border-base-300 rounded-2xl p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold m-0 break-all">{file.name}</h1>
          {file.isPublic ? (
            <span className="badge badge-success gap-1 shrink-0">
              <LockOpenIcon className="h-3 w-3" /> Public
            </span>
          ) : (
            <span className="badge badge-secondary gap-1 shrink-0">
              <LockClosedIcon className="h-3 w-3" /> Private
            </span>
          )}
        </div>

        <dl className="grid grid-cols-3 gap-y-3 text-sm">
          <dt className="text-base-content/50">Type</dt>
          <dd className="col-span-2 break-all">{file.mimeType}</dd>

          <dt className="text-base-content/50">Price</dt>
          <dd className="col-span-2 font-medium">
            {file.isPublic ? "Free" : `${formatTinybar(file.priceTinybar)} HBAR / download`}
          </dd>

          <dt className="text-base-content/50">Owner</dt>
          <dd className="col-span-2">
            <HederaAddress address={file.owner as `0x${string}`} chain={targetNetwork} />
          </dd>

          {!file.isPublic && (
            <>
              <dt className="text-base-content/50">Pays to</dt>
              <dd className="col-span-2 font-mono">{file.payToAccountId}</dd>
            </>
          )}

          <dt className="text-base-content/50">SHA-256</dt>
          <dd className="col-span-2 font-mono text-xs break-all">{file.contentHash}</dd>
        </dl>

        <div className="border-t border-base-200 pt-5">
          {file.isPublic ? (
            <button className="btn btn-primary w-full gap-2" disabled={downloading} onClick={handleFreeDownload}>
              {downloading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                <ArrowDownTrayIcon className="h-4 w-4" />
              )}
              Download (free)
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              {!canPayWithHashpack ? (
                <button
                  className="btn btn-outline w-full"
                  disabled={hashpack.connecting || downloading}
                  onClick={() => hashpack.connect().catch(e => notification.error(getParsedError(e)))}
                >
                  {hashpack.connecting ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    "Connect HashPack to pay"
                  )}
                </button>
              ) : (
                <div className="flex items-center justify-between gap-2 text-xs text-base-content/60 px-1">
                  <span>
                    Paying as <span className="font-mono">{hashpack.accountIds[0]}</span>
                  </span>
                  <button
                    className="btn btn-ghost btn-xs"
                    disabled={hashpack.connecting || downloading}
                    onClick={() => hashpack.disconnect().catch(e => notification.error(getParsedError(e)))}
                  >
                    Disconnect
                  </button>
                </div>
              )}
              <button
                className="btn btn-primary w-full gap-2"
                disabled={downloading || !canPay || onWrongNetwork}
                onClick={handlePaidDownload}
              >
                {downloading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <ArrowDownTrayIcon className="h-4 w-4" />
                )}
                Pay {formatTinybar(file.priceTinybar)} HBAR & download
              </button>
              {!canPay && (
                <span className="text-xs text-center text-base-content/50">
                  Connect HashPack above, or use the Burner Wallet (<strong>Development → Burner Wallet</strong>) for
                  local dev. MetaMask cannot sign native Hedera x402 transfers.
                </span>
              )}
              {onWrongNetwork && (
                <span className="text-xs text-center text-warning">Switch to {targetNetwork.name} to pay.</span>
              )}
            </div>
          )}

          {receipt && <p className="text-xs text-center text-success mt-3 m-0 break-all">Settled · tx {receipt}</p>}
        </div>
      </div>

      {!file.isPublic && <AgentSnippet fileId={file.fileId} resourceUrl={resourceUrl} />}

      {isOwner && registryAddress && (
        <OwnerControls
          file={file}
          onUpdated={load}
          write={async (functionName, args) => {
            const hash = await writeContractAsync({
              abi: FILE_REGISTRY_ABI,
              address: registryAddress,
              functionName,
              args,
            } as never);
            await publicClient?.waitForTransactionReceipt({ hash });
          }}
        />
      )}
    </div>
  );
};

/** Copy-paste command for paying via the Node agent script (machine-to-machine flow). */
const AgentSnippet = ({ fileId, resourceUrl }: { fileId: string; resourceUrl: string }) => {
  const command = `RESOURCE_URL="${resourceUrl}" \\\n  BUYER_ACCOUNT_ID=0.0.xxxx BUYER_PRIVATE_KEY=0x... \\\n  yarn x402:buy`;
  return (
    <div className="bg-base-100 border border-base-300 rounded-2xl p-5 mt-5">
      <div className="flex items-center gap-2 mb-2">
        <CommandLineIcon className="h-4 w-4" />
        <span className="font-semibold text-sm">Pay from an agent / script</span>
      </div>
      <p className="text-xs text-base-content/60 m-0 mb-3">
        Any x402 client can pay for file <span className="font-mono break-all">{fileId}</span>. Example with the bundled
        Node buyer:
      </p>
      <pre className="bg-base-200 rounded-lg p-3 text-xs overflow-x-auto m-0">
        <code>{command}</code>
      </pre>
    </div>
  );
};

/** Owner-only price / visibility controls. */
const OwnerControls = ({
  file,
  write,
  onUpdated,
}: {
  file: PublicFile;
  write: (functionName: "setPrice" | "setVisibility", args: readonly unknown[]) => Promise<void>;
  onUpdated: () => void;
}) => {
  const [priceHbar, setPriceHbar] = useState(formatTinybar(file.priceTinybar));
  const [busy, setBusy] = useState<"price" | "visibility" | null>(null);

  const updatePrice = async () => {
    setBusy("price");
    const toastId = notification.loading("Updating price…");
    try {
      await write("setPrice", [file.fileId as `0x${string}`, hbarToTinybar(priceHbar)]);
      notification.remove(toastId);
      notification.success("Price updated");
      onUpdated();
    } catch (e) {
      notification.remove(toastId);
      notification.error(getParsedError(e));
    } finally {
      setBusy(null);
    }
  };

  const toggleVisibility = async () => {
    setBusy("visibility");
    const toastId = notification.loading("Updating visibility…");
    try {
      await write("setVisibility", [file.fileId as `0x${string}`, !file.isPublic]);
      notification.remove(toastId);
      notification.success("Visibility updated");
      onUpdated();
    } catch (e) {
      notification.remove(toastId);
      notification.error(getParsedError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-base-100 border border-base-300 rounded-2xl p-5 mt-5">
      <span className="font-semibold text-sm">Owner controls</span>
      <div className="flex flex-col sm:flex-row gap-3 mt-3">
        <div className="join flex-1">
          <input
            type="text"
            inputMode="decimal"
            className="input input-bordered join-item w-full"
            value={priceHbar}
            onChange={e => setPriceHbar(e.target.value)}
            aria-label="New price in HBAR"
          />
          <button className="btn btn-outline join-item" disabled={busy !== null} onClick={updatePrice}>
            {busy === "price" ? <span className="loading loading-spinner loading-sm" /> : "Set price"}
          </button>
        </div>
        <button className="btn btn-outline" disabled={busy !== null} onClick={toggleVisibility}>
          {busy === "visibility" ? (
            <span className="loading loading-spinner loading-sm" />
          ) : file.isPublic ? (
            "Make private"
          ) : (
            "Make public"
          )}
        </button>
      </div>
    </div>
  );
};

export default FileDetail;
