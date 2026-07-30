"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { ArrowPathIcon, ArrowUpTrayIcon, LockClosedIcon, LockOpenIcon } from "@heroicons/react/24/outline";
import { ReportTypeBadge, SyntheticBadge } from "~~/components/hashmed/ReportBadges";
import { getFileRegistryAddress } from "~~/contracts/fileRegistryAbi";
import { useRegistryFileListing, useTargetNetwork } from "~~/hooks/scaffold-hbar";
import { decodeReportName, formatSpecimenDate, reportTypeLabel } from "~~/utils/hashmed/reportMetadata";
import { formatTinybar } from "~~/utils/x402";

const ALL_TYPES = "all";

const Marketplace: NextPage = () => {
  const { targetNetwork } = useTargetNetwork();
  const registryAddress = getFileRegistryAddress(targetNetwork.id);

  const {
    data: files = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useRegistryFileListing(targetNetwork.id, { watch: true });

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);

  // The registry `name` carries the medical metadata, so decode once per listing
  // and reuse it for filtering and rendering.
  const reports = useMemo(() => files.map(file => ({ ...file, report: decodeReportName(file.name) })), [files]);

  /** Only offer filters for types that are actually listed. */
  const availableTypes = useMemo(() => {
    const codes = new Set(reports.map(({ report }) => report.reportType).filter(Boolean));
    return [...codes].sort();
  }, [reports]);

  const visibleReports = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return reports.filter(({ report }) => {
      if (typeFilter !== ALL_TYPES && report.reportType !== typeFilter) return false;
      if (!needle) return true;
      return [report.title, report.labName, report.patientPseudonym, reportTypeLabel(report.reportType)]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [reports, search, typeFilter]);

  const registryMissing = !registryAddress;
  const loadFailed = isError;
  const filtersActive = search.trim() !== "" || typeFilter !== ALL_TYPES;

  return (
    <div className="flex flex-col grow w-full max-w-5xl mx-auto px-5 py-10">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight m-0">Lab Report Exchange</h1>
          <p className="text-sm sm:text-base text-base-content/60 m-0 mt-1.5 max-w-2xl">
            Open-access reports read for free. Pay-per-read reports cost one HBAR micro-payment per read.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void refetch()}
            aria-label="Refresh"
            disabled={isLoading}
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
          <Link href="/files/upload" className="btn btn-primary btn-sm gap-2">
            <ArrowUpTrayIcon className="h-4 w-4" /> Publish a report
          </Link>
        </div>
      </div>

      {!isLoading && !loadFailed && files.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="search"
            className="input input-bordered input-sm w-full sm:w-72"
            placeholder="Search title, lab, or pseudonym"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search lab reports"
          />
          {availableTypes.length > 0 && (
            <select
              className="select select-bordered select-sm"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              aria-label="Filter by report type"
            >
              <option value={ALL_TYPES}>All report types</option>
              {availableTypes.map(code => (
                <option key={code} value={code}>
                  {reportTypeLabel(code)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {registryMissing && (
        <div className="bg-warning/10 border border-warning/25 rounded-xl px-4 py-3">
          <span className="text-sm">
            FileRegistry is not deployed on {targetNetwork.name}. Deploy with{" "}
            <code className="text-xs bg-base-200 px-1.5 py-0.5 rounded">
              yarn hardhat:deploy --network hederaTestnet
            </code>{" "}
            first.
          </span>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-base-200 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && loadFailed && (
        <div className="bg-error/10 border border-error/25 rounded-xl px-4 py-3">
          <span className="text-sm">{error?.message ?? "Failed to load reports from the registry"}</span>
        </div>
      )}

      {!isLoading && !loadFailed && !registryMissing && files.length === 0 && (
        <div className="bg-base-100 border border-base-300 rounded-2xl p-12 text-center">
          <p className="text-base-content/70 m-0 mb-4">No lab reports published yet.</p>
          <Link href="/files/upload" className="btn btn-primary btn-sm">
            Publish the first report
          </Link>
        </div>
      )}

      {!isLoading && !loadFailed && files.length > 0 && visibleReports.length === 0 && (
        <div className="bg-base-100 border border-base-300 rounded-2xl p-12 text-center">
          <p className="text-base-content/70 m-0">No reports match those filters.</p>
        </div>
      )}

      {!isLoading && !loadFailed && visibleReports.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleReports.map(file => (
            <article
              key={file.fileId}
              className="group bg-base-100 border border-base-300 rounded-2xl flex flex-col transition-colors hover:border-primary/40"
            >
              <Link href={`/files/${file.fileId}`} className="flex flex-col gap-3 flex-1 p-5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {file.isPublic ? (
                    <span className="badge badge-success badge-sm gap-1 shrink-0">
                      <LockOpenIcon className="h-3 w-3" /> Open access
                    </span>
                  ) : (
                    <span className="badge badge-primary badge-sm badge-outline gap-1 shrink-0">
                      <LockClosedIcon className="h-3 w-3" /> Pay per read
                    </span>
                  )}
                  <ReportTypeBadge code={file.report.reportType} />
                  <SyntheticBadge />
                </div>

                <div className="flex flex-col gap-1 flex-1">
                  <span className="font-semibold leading-snug break-words line-clamp-2 transition-colors group-hover:text-primary">
                    {file.report.title}
                  </span>
                  {/* Always rendered so every card's footer lands on the same baseline. */}
                  <span className="text-xs text-base-content/50 min-h-4">
                    {[formatSpecimenDate(file.report.specimenDate), file.report.patientPseudonym]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>

                <div className="mt-auto pt-3 border-t border-base-200 flex flex-col gap-1">
                  {file.isPublic ? (
                    <span className="text-sm font-medium text-success">Free read</span>
                  ) : (
                    <span className="text-sm font-medium tabular-nums">
                      {formatTinybar(file.priceTinybar)} HBAR / read
                    </span>
                  )}
                  <span className="flex items-baseline gap-1.5 min-w-0 text-xs">
                    <span className="shrink-0 text-base-content/50">Issuing lab</span>
                    {file.report.labName ? (
                      <span className="truncate text-base-content/80">{file.report.labName}</span>
                    ) : (
                      <span
                        className="truncate text-base-content/40 italic"
                        title="Registered without HashMed metadata — the issuing lab is not recorded on-chain."
                      >
                        {file.report.isStructured ? "Lab not disclosed" : "Unknown lab (legacy listing)"}
                      </span>
                    )}
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}

      {!isLoading && !loadFailed && filtersActive && visibleReports.length > 0 && (
        <p className="text-xs text-base-content/50 mt-4 m-0">
          Showing {visibleReports.length} of {files.length} reports.
        </p>
      )}
    </div>
  );
};

export default Marketplace;
