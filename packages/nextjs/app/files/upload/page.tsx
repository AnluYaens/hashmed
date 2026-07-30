"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { NextPage } from "next";
import { type Address, type Hex, toHex } from "viem";
import { ArrowUpTrayIcon, BeakerIcon } from "@heroicons/react/24/outline";
import {
  FILE_REGISTRY_ABI,
  computeFileId,
  getFileRegistryAddress,
  getFileRegistryHederaContractId,
} from "~~/contracts/fileRegistryAbi";
import { useFetchHbarPrice, useHederaEvmAddress, useTargetNetwork } from "~~/hooks/scaffold-hbar";
import { waitForHederaTransaction, writeContractViaNativeProvider } from "~~/services/web3/hederaContractWrite";
import { useHederaWalletConnect } from "~~/services/web3/hederaWalletConnect";
import {
  PSEUDONYM_PATTERN,
  REPORT_TYPES,
  encodeReportName,
  randomPatientPseudonym,
  reportTypeLabel,
} from "~~/utils/hashmed/reportMetadata";
import { SAMPLE_REPORTS, getSampleReport } from "~~/utils/hashmed/sampleReports";
import { getParsedError, notification } from "~~/utils/scaffold-hbar";
import { hbarToTinybar } from "~~/utils/x402";

const HEDERA_ID_RE = /^\d+\.\d+\.\d+$/;

/** A micro-price: small enough that paying per read is unremarkable. */
const DEFAULT_PRICE_HBAR = "0.001";

/** SHA-256 of a file's bytes, as a `bytes32` hex string for on-chain integrity. */
async function sha256Hex(file: File): Promise<Hex> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return toHex(new Uint8Array(digest));
}

const PublishReport: NextPage = () => {
  const router = useRouter();
  const { isConnected, hederaAccountId, hasHederaSession, provider } = useHederaWalletConnect();
  const { targetNetwork } = useTargetNetwork();
  const { evmAddress, isLoading: resolvingEvmAddress } = useHederaEvmAddress(hederaAccountId, targetNetwork.id);
  const { price: hbarUsdPrice } = useFetchHbarPrice();

  const [file, setFile] = useState<File | null>(null);
  const [reportType, setReportType] = useState<string>(REPORT_TYPES[0].code);
  const [title, setTitle] = useState<string>(REPORT_TYPES[0].label);
  const [labName, setLabName] = useState("");
  // Generated after mount: these depend on Math.random / the clock, which would
  // not match the server-rendered markup.
  const [specimenDate, setSpecimenDate] = useState("");
  const [patientPseudonym, setPatientPseudonym] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [priceHbar, setPriceHbar] = useState(DEFAULT_PRICE_HBAR);
  const [payTo, setPayTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);

  useEffect(() => {
    setPatientPseudonym(randomPatientPseudonym());
    setSpecimenDate(new Date().toISOString().slice(0, 10));
  }, []);

  const registryAddress = getFileRegistryAddress(targetNetwork.id);
  const registryHederaContractId = getFileRegistryHederaContractId(targetNetwork.id);
  const effectivePayTo = payTo || hederaAccountId || "";
  const ownerEvmAddress = evmAddress as Address | undefined;

  const priceError = useMemo(() => {
    if (isPublic) return null;
    try {
      const tinybar = hbarToTinybar(priceHbar);
      if (tinybar <= 0n) return "Pay-per-read reports need a price above 0";
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid price";
    }
  }, [isPublic, priceHbar]);

  const pseudonymError = useMemo(() => {
    if (!patientPseudonym) return "A patient pseudonym is required";
    return PSEUDONYM_PATTERN.test(patientPseudonym) ? null : "Use a pseudonym like SYN-4821 — never a real identifier";
  }, [patientPseudonym]);

  const priceUsd = useMemo(() => {
    if (isPublic || hbarUsdPrice <= 0) return null;
    const parsed = Number(priceHbar);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed * hbarUsdPrice;
  }, [hbarUsdPrice, isPublic, priceHbar]);

  const canSubmit =
    !!file &&
    !!title.trim() &&
    !!labName.trim() &&
    !!specimenDate &&
    !pseudonymError &&
    !!hederaAccountId &&
    !!ownerEvmAddress &&
    !!registryAddress &&
    !priceError &&
    !busy &&
    hasHederaSession;

  const handleReportType = (code: string) => {
    setReportType(code);
    setTitle(reportTypeLabel(code));
  };

  /** Pull one of the shipped synthetic reports into the form, PDF included. */
  const handleSample = async (sampleId: string) => {
    const sample = getSampleReport(sampleId);
    if (!sample) return;

    setLoadingSample(true);
    try {
      const res = await fetch(sample.path);
      if (!res.ok) throw new Error(`Could not load ${sample.fileName}`);
      const blob = await res.blob();
      setFile(new File([blob], sample.fileName, { type: "application/pdf" }));
      setReportType(sample.meta.reportType);
      setTitle(sample.meta.title);
      setLabName(sample.meta.labName);
      setSpecimenDate(sample.meta.specimenDate);
      setPatientPseudonym(sample.meta.patientPseudonym);
      notification.success(`Loaded ${sample.meta.title}`);
    } catch (e) {
      notification.error(getParsedError(e));
    } finally {
      setLoadingSample(false);
    }
  };

  const handleSubmit = async () => {
    if (!file || !hederaAccountId || !ownerEvmAddress || !registryAddress || !provider) return;

    const payToTrimmed = effectivePayTo.trim();
    if (!HEDERA_ID_RE.test(payToTrimmed)) {
      notification.error("Enter a valid payout account id (e.g. 0.0.1234)");
      return;
    }

    let priceTinybar: bigint;
    let registryName: string;
    try {
      priceTinybar = isPublic ? 0n : hbarToTinybar(priceHbar);
      // The contract has no medical columns, so the metadata is encoded into `name`.
      registryName = encodeReportName({
        title: title.trim(),
        reportType,
        labName: labName.trim(),
        specimenDate,
        patientPseudonym,
      });
    } catch (e) {
      notification.error(e instanceof Error ? e.message : "Invalid report details");
      return;
    }

    setBusy(true);
    const toastId = notification.loading("Requesting upload URL…");
    try {
      const uploadRes = await fetch("/api/files/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // The plain title only feeds the storage object key; the chain gets the encoded name.
        body: JSON.stringify({ name: title.trim(), mimeType: file.type || "application/octet-stream" }),
      });
      const uploadData = (await uploadRes.json()) as {
        objectKey?: string;
        uploadUrl?: string;
        contentType?: string;
        error?: string;
      };
      if (!uploadRes.ok || !uploadData.uploadUrl || !uploadData.objectKey) {
        throw new Error(uploadData.error ?? "Failed to get upload URL");
      }

      notification.remove(toastId);
      const hashToastId = notification.loading("Uploading report…");
      const contentHash = await sha256Hex(file);
      const putRes = await fetch(uploadData.uploadUrl, {
        method: "PUT",
        headers: { "content-type": uploadData.contentType ?? "application/octet-stream" },
        body: file,
      });
      notification.remove(hashToastId);
      if (!putRes.ok) throw new Error(`Upload failed (status ${putRes.status})`);

      const registerToastId = notification.loading("Confirm registration in your wallet…");
      const objectKey = uploadData.objectKey;
      const registerArgs = [
        objectKey,
        payToTrimmed,
        priceTinybar,
        isPublic,
        contentHash,
        registryName,
        file.type || "application/octet-stream",
      ] as const;

      const { transactionId } = await writeContractViaNativeProvider({
        provider,
        hederaAccountId,
        chainId: targetNetwork.id,
        contractAddress: registryAddress,
        hederaContractId: registryHederaContractId,
        abi: FILE_REGISTRY_ABI,
        functionName: "registerFile",
        fnArgs: registerArgs,
      });
      await waitForHederaTransaction(transactionId, targetNetwork.id);
      notification.remove(registerToastId);
      notification.success("Report published!");

      const fileId = computeFileId(ownerEvmAddress, objectKey);
      router.push(`/files/${fileId}`);
    } catch (e) {
      notification.remove(toastId);
      notification.error(getParsedError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col grow w-full max-w-2xl mx-auto px-5 py-10">
      <h1 className="text-3xl font-bold m-0 mb-1">Publish a lab report</h1>
      <p className="text-base-content/60 m-0 mb-8">
        The document goes to private storage. Its metadata, price per read, and access mode are registered on-chain, so
        the payment itself is what unlocks a read.
      </p>

      {!registryAddress && (
        <div className="alert alert-warning mb-6">
          <span>
            FileRegistry is not deployed on {targetNetwork.name}. Run <code>yarn deploy</code> (or set{" "}
            <code>NEXT_PUBLIC_FILE_REGISTRY_ADDRESS</code>) and reload.
          </span>
        </div>
      )}

      <div className="bg-base-100 border border-base-300 rounded-2xl p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-2 rounded-xl bg-base-200 p-4">
          <div className="flex items-center gap-2">
            <BeakerIcon className="h-4 w-4 text-warning" />
            <span className="text-sm font-medium">Start from a synthetic report</span>
          </div>
          <p className="text-xs text-base-content/60 m-0">
            Fabricated reports bundled with the demo. Loading one fills in the document and every field below.
          </p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_REPORTS.map(sample => (
              <button
                key={sample.id}
                type="button"
                className="btn btn-outline btn-xs"
                disabled={loadingSample || busy}
                onClick={() => void handleSample(sample.id)}
              >
                {sample.meta.title}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Report document</span>
          <input
            type="file"
            accept="application/pdf"
            className="file-input file-input-bordered w-full"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
          {file && <span className="text-xs text-base-content/50">Selected: {file.name}</span>}
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Report type</span>
            <select
              className="select select-bordered w-full"
              value={reportType}
              onChange={e => handleReportType(e.target.value)}
            >
              {REPORT_TYPES.map(type => (
                <option key={type.code} value={type.code}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Specimen date</span>
            <input
              type="date"
              className="input input-bordered w-full"
              value={specimenDate}
              onChange={e => setSpecimenDate(e.target.value)}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Report title</span>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="Complete Blood Count"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Issuing lab</span>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="Northwind Reference Lab"
            value={labName}
            onChange={e => setLabName(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Patient pseudonym</span>
          <div className="join">
            <input
              type="text"
              className={`input input-bordered join-item w-full ${pseudonymError ? "input-error" : ""}`}
              placeholder="SYN-4821"
              value={patientPseudonym}
              onChange={e => setPatientPseudonym(e.target.value.toUpperCase())}
            />
            <button
              type="button"
              className="btn btn-outline join-item"
              onClick={() => setPatientPseudonym(randomPatientPseudonym())}
            >
              New
            </button>
          </div>
          {pseudonymError ? (
            <span className="text-xs text-error">{pseudonymError}</span>
          ) : (
            <span className="text-xs text-base-content/50">
              Pseudonym only — never a real name, record number, or date of birth.
            </span>
          )}
        </label>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium">Access mode</span>
            <p className="text-xs text-base-content/50 m-0">
              {isPublic ? "Anyone can read this report for free." : "Each read costs one HBAR micro-payment."}
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm">{isPublic ? "Open access" : "Pay per read"}</span>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={!isPublic}
              onChange={e => setIsPublic(!e.target.checked)}
            />
          </label>
        </div>

        {!isPublic && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Price per read (HBAR)</span>
            <input
              type="text"
              inputMode="decimal"
              className={`input input-bordered w-full ${priceError ? "input-error" : ""}`}
              value={priceHbar}
              onChange={e => setPriceHbar(e.target.value)}
            />
            {priceError ? (
              <span className="text-xs text-error">{priceError}</span>
            ) : (
              <span className="text-xs text-base-content/50">
                {priceUsd !== null ? `About $${priceUsd.toFixed(5)} per read at the current HBAR price.` : ""}
              </span>
            )}
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Lab payout account (receives payments)</span>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder={hederaAccountId ?? "0.0.1234"}
            value={payTo}
            onChange={e => setPayTo(e.target.value)}
          />
          <span className="text-xs text-base-content/50">
            {hederaAccountId ? `Defaults to your account ${hederaAccountId}` : "Your Hedera account id (0.0.x)"}
          </span>
        </label>

        <button className="btn btn-primary gap-2" disabled={!canSubmit} onClick={handleSubmit}>
          {busy ? <span className="loading loading-spinner loading-sm" /> : <ArrowUpTrayIcon className="h-4 w-4" />}
          {busy ? "Working…" : "Publish report"}
        </button>
        {!isConnected && (
          <span className="text-xs text-center text-base-content/50">
            Connect HashPack in the header to publish reports.
          </span>
        )}
        {isConnected && !hasHederaSession && (
          <span className="text-xs text-center text-warning">
            Reconnect HashPack to approve native Hedera signing for registration.
          </span>
        )}
        {isConnected && hasHederaSession && !ownerEvmAddress && !resolvingEvmAddress && (
          <span className="text-xs text-center text-warning">
            This account has no EVM alias on {targetNetwork.name}. Use an ECDSA testnet account.
          </span>
        )}
      </div>
    </div>
  );
};

export default PublishReport;
