"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { useReadContracts } from "wagmi";
import { ArrowPathIcon, ArrowUpTrayIcon, LockClosedIcon, LockOpenIcon } from "@heroicons/react/24/outline";
import { HederaAddress } from "~~/components/scaffold-hbar";
import { FILE_REGISTRY_ABI } from "~~/contracts/fileRegistryAbi";
import { useDeployedContractInfo, useScaffoldEventHistory, useTargetNetwork } from "~~/hooks/scaffold-hbar";
import type { AllowedChainIds } from "~~/utils/scaffold-hbar";
import { formatTinybar } from "~~/utils/x402";

type RegistryFile = {
  fileId: `0x${string}`;
  name: string;
  mimeType: string;
  isPublic: boolean;
  priceTinybar: string;
  owner: `0x${string}`;
  payToAccountId: string;
};

const Marketplace: NextPage = () => {
  const { targetNetwork } = useTargetNetwork();
  const { data: deployedContract, isLoading: deployLoading } = useDeployedContractInfo({
    contractName: "FileRegistry",
    chainId: targetNetwork.id as AllowedChainIds,
  });

  const {
    data: registrationEvents,
    status: eventsStatus,
    error: eventsError,
    isLoading: eventsLoading,
    refetch: refetchEvents,
  } = useScaffoldEventHistory({
    contractName: "FileRegistry",
    eventName: "FileRegistered",
    watch: true,
  });

  const fileIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: `0x${string}`[] = [];
    for (const event of registrationEvents ?? []) {
      const fileId = event.args?.fileId as `0x${string}` | undefined;
      if (!fileId || seen.has(fileId)) continue;
      seen.add(fileId);
      ids.push(fileId);
    }
    return ids;
  }, [registrationEvents]);

  const {
    data: fileReads,
    isLoading: readsLoading,
    refetch: refetchFiles,
  } = useReadContracts({
    contracts: fileIds.map(fileId => ({
      chainId: targetNetwork.id,
      address: deployedContract?.address,
      abi: FILE_REGISTRY_ABI,
      functionName: "getFile" as const,
      args: [fileId] as const,
    })),
    query: {
      enabled: Boolean(deployedContract?.address) && fileIds.length > 0,
    },
  });

  const files = useMemo((): RegistryFile[] => {
    if (!fileReads) return [];
    return fileIds
      .map((fileId, index) => {
        const read = fileReads[index];
        if (!read || read.status !== "success" || !read.result) return null;
        const item = read.result as {
          owner: `0x${string}`;
          payToAccountId: string;
          priceTinybar: bigint;
          isPublic: boolean;
          name: string;
          mimeType: string;
          exists: boolean;
        };
        if (!item.exists) return null;
        return {
          fileId,
          name: item.name,
          mimeType: item.mimeType,
          isPublic: item.isPublic,
          priceTinybar: item.priceTinybar.toString(),
          owner: item.owner,
          payToAccountId: item.payToAccountId,
        };
      })
      .filter((file): file is RegistryFile => file !== null);
  }, [fileIds, fileReads]);

  const refresh = () => {
    void refetchEvents();
    void refetchFiles();
  };

  const registryMissing = !deployLoading && !deployedContract?.address;
  const isLoading = deployLoading || eventsLoading || (fileIds.length > 0 && readsLoading);
  const loadFailed = eventsStatus === "error";

  return (
    <div className="flex flex-col grow w-full max-w-5xl mx-auto px-5 py-10">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold m-0">File Marketplace</h1>
          <p className="text-base-content/60 m-0 mt-1">
            Public files are free. Private files are pay-per-download in HBAR.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost btn-sm" onClick={refresh} aria-label="Refresh" disabled={isLoading}>
            <ArrowPathIcon className="h-4 w-4" />
          </button>
          <Link href="/files/upload" className="btn btn-primary btn-sm gap-2">
            <ArrowUpTrayIcon className="h-4 w-4" /> Upload a file
          </Link>
        </div>
      </div>

      {registryMissing && (
        <div className="alert alert-warning">
          <span>
            FileRegistry is not deployed on {targetNetwork.name}. Deploy with{" "}
            <code className="text-xs">yarn hardhat:deploy --network hederaTestnet</code> first.
          </span>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-base-200 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && loadFailed && (
        <div className="alert alert-warning">
          <span>{eventsError?.message ?? "Failed to load FileRegistered events from the chain"}</span>
        </div>
      )}

      {!isLoading && !loadFailed && !registryMissing && files.length === 0 && (
        <div className="bg-base-100 border border-base-300 rounded-2xl p-12 text-center">
          <p className="text-base-content/70 m-0 mb-4">No files registered yet.</p>
          <Link href="/files/upload" className="btn btn-primary btn-sm">
            Upload the first file
          </Link>
        </div>
      )}

      {!isLoading && !loadFailed && files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map(file => (
            <article
              key={file.fileId}
              className="bg-base-100 border border-base-300 rounded-2xl p-5 flex flex-col gap-3"
            >
              <Link
                href={`/files/${file.fileId}`}
                className="flex flex-col gap-3 flex-1 hover:opacity-90 transition-opacity"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold break-all line-clamp-2">{file.name}</span>
                  {file.isPublic ? (
                    <span className="badge badge-success badge-sm gap-1 shrink-0">
                      <LockOpenIcon className="h-3 w-3" /> Public
                    </span>
                  ) : (
                    <span className="badge badge-secondary badge-sm gap-1 shrink-0">
                      <LockClosedIcon className="h-3 w-3" /> Private
                    </span>
                  )}
                </div>
                <span className="text-xs text-base-content/50 break-all">{file.mimeType}</span>
                <div className="mt-auto pt-2 border-t border-base-200">
                  {file.isPublic ? (
                    <span className="text-sm font-medium text-success">Free download</span>
                  ) : (
                    <span className="text-sm font-medium">{formatTinybar(file.priceTinybar)} HBAR / download</span>
                  )}
                </div>
              </Link>
              <div className="text-xs text-base-content/60 border-t border-base-200 pt-2">
                <span className="text-base-content/50">Owner </span>
                <HederaAddress address={file.owner} chain={targetNetwork} disableAddressLink />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default Marketplace;
