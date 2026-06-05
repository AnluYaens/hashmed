"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { ArrowPathIcon, ArrowUpTrayIcon, LockClosedIcon, LockOpenIcon } from "@heroicons/react/24/outline";
import { formatTinybar } from "~~/utils/x402";

type PublicFile = {
  fileId: string;
  name: string;
  mimeType: string;
  isPublic: boolean;
  priceTinybar: string;
  owner: string;
  payToAccountId: string;
};

type ListResponse = { files?: PublicFile[]; total?: number; error?: string };

const Marketplace: NextPage = () => {
  const [files, setFiles] = useState<PublicFile[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/files");
      const data = (await res.json()) as ListResponse;
      if (!res.ok) {
        setMessage(data.error ?? "Failed to load files");
        setStatus("error");
        setFiles([]);
        return;
      }
      setFiles(data.files ?? []);
      setStatus("ready");
    } catch {
      setMessage("Could not reach the server");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
          <button className="btn btn-ghost btn-sm" onClick={load} aria-label="Refresh">
            <ArrowPathIcon className="h-4 w-4" />
          </button>
          <Link href="/files/upload" className="btn btn-primary btn-sm gap-2">
            <ArrowUpTrayIcon className="h-4 w-4" /> Upload a file
          </Link>
        </div>
      </div>

      {status === "loading" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-base-200 animate-pulse" />
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="alert alert-warning">
          <span>{message}</span>
        </div>
      )}

      {status === "ready" && files.length === 0 && (
        <div className="bg-base-100 border border-base-300 rounded-2xl p-12 text-center">
          <p className="text-base-content/70 m-0 mb-4">No files registered yet.</p>
          <Link href="/files/upload" className="btn btn-primary btn-sm">
            Upload the first file
          </Link>
        </div>
      )}

      {status === "ready" && files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map(file => (
            <Link
              key={file.fileId}
              href={`/files/${file.fileId}`}
              className="bg-base-100 border border-base-300 rounded-2xl p-5 hover:shadow-lg hover:border-primary/40 transition-all flex flex-col gap-3"
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
          ))}
        </div>
      )}
    </div>
  );
};

export default Marketplace;
