/**
 * Lab-report metadata for HashMed.
 *
 * `FileRegistry` has a fixed set of columns and this template must not change
 * the contract, so the medical fields ride inside the one free-form column the
 * registry does expose: `name`. A report registers with a small versioned JSON
 * object as its name and the UI decodes it back into structured fields.
 *
 * The encoding is deliberately boring — plain JSON with readable keys — so a
 * judge inspecting the `registerFile` transaction on HashScan can read the
 * metadata without any tooling.
 *
 * Anything registered before this encoding existed (or by any other x402
 * client) simply has a plain string name. {@link decodeReportName} treats that
 * as a title-only report rather than an error, so old listings keep rendering.
 *
 * Every value here is synthetic demo data. Patients are referenced by
 * pseudonym only — never by a real identifier.
 */

/** Marker + schema version stored as the JSON object's `hm` key. */
const SCHEMA_VERSION = 1;

/** Catalogue of report types a lab can publish. Codes are stored on-chain; labels are display-only. */
export const REPORT_TYPES = [
  { code: "CBC", label: "Complete Blood Count" },
  { code: "CMP", label: "Comprehensive Metabolic Panel" },
  { code: "LIPID", label: "Lipid Panel" },
  { code: "HBA1C", label: "Hemoglobin A1c" },
  { code: "TSH", label: "Thyroid Panel (TSH)" },
  { code: "UA", label: "Urinalysis" },
  { code: "VITD", label: "Vitamin D, 25-Hydroxy" },
  { code: "CULTURE", label: "Microbiology Culture" },
  { code: "PATH", label: "Pathology Report" },
  { code: "IMAGING", label: "Imaging Report" },
] as const;

export type ReportTypeCode = (typeof REPORT_TYPES)[number]["code"];

/** The medical metadata a lab attaches to a published report. */
export type LabReportMeta = {
  /** Human-readable report title, e.g. "Complete Blood Count". */
  title: string;
  /** Report type code from {@link REPORT_TYPES} (free text tolerated on decode). */
  reportType: string;
  /** Issuing laboratory name (synthetic). */
  labName: string;
  /** Specimen collection date as `YYYY-MM-DD`. */
  specimenDate: string;
  /** Patient pseudonym, e.g. `SYN-4821`. Never a real patient identifier. */
  patientPseudonym: string;
};

/** A decoded report, plus whether the on-chain name actually carried metadata. */
export type DecodedReport = LabReportMeta & {
  /** False when the registry name was a plain string, so only `title` is meaningful. */
  isStructured: boolean;
};

/**
 * Pseudonyms are a fixed shape so the UI can reject anything resembling a real
 * medical record number, name, or date of birth.
 */
export const PSEUDONYM_PATTERN = /^[A-Z]{2,6}-\d{3,6}$/;

/** `YYYY-MM-DD`, the only accepted specimen-date shape. */
export const SPECIMEN_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Upper bound on the encoded name. The string is stored on-chain, so this caps
 * `registerFile` gas and keeps the value comfortably renderable.
 */
export const MAX_ENCODED_NAME_BYTES = 512;

/** Longest single field accepted on encode, and the clamp applied on decode. */
const MAX_FIELD_LENGTH = 120;

/** Whether `value` is one of the known report type codes. */
export function isReportTypeCode(value: string): value is ReportTypeCode {
  return REPORT_TYPES.some(type => type.code === value);
}

/**
 * Display label for a report type code.
 *
 * @param code - Report type code, possibly unknown (on-chain data is untrusted).
 * @returns The catalogue label, or the code itself when unrecognised.
 */
export function reportTypeLabel(code: string): string {
  return REPORT_TYPES.find(type => type.code === code)?.label ?? code;
}

/**
 * Encode lab-report metadata into the string stored as the registry `name`.
 *
 * @param meta - The report's medical metadata.
 * @returns A JSON string safe to pass to `registerFile`.
 * @throws When the title is empty or the encoded value exceeds
 *   {@link MAX_ENCODED_NAME_BYTES}.
 */
export function encodeReportName(meta: LabReportMeta): string {
  const title = meta.title.trim();
  if (!title) throw new Error("Report title is required");

  const encoded = JSON.stringify({
    hm: SCHEMA_VERSION,
    title: clamp(title),
    type: clamp(meta.reportType.trim()),
    lab: clamp(meta.labName.trim()),
    specimenDate: clamp(meta.specimenDate.trim()),
    patient: clamp(meta.patientPseudonym.trim()),
  });

  const bytes = new TextEncoder().encode(encoded).length;
  if (bytes > MAX_ENCODED_NAME_BYTES) {
    throw new Error(`Report metadata is too large (${bytes} bytes, max ${MAX_ENCODED_NAME_BYTES})`);
  }
  return encoded;
}

/**
 * Decode a registry `name` back into lab-report metadata.
 *
 * Never throws: the registry holds text written by anyone, so a name that is
 * not HashMed JSON is reported as a title-only report via `isStructured:
 * false`.
 *
 * @param rawName - The `name` field as stored on-chain.
 * @returns The decoded report.
 */
export function decodeReportName(rawName: string): DecodedReport {
  const fallback: DecodedReport = {
    title: clamp(rawName.trim()) || "Untitled report",
    reportType: "",
    labName: "",
    specimenDate: "",
    patientPseudonym: "",
    isStructured: false,
  };

  if (!rawName.trimStart().startsWith("{")) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawName);
  } catch {
    return fallback;
  }

  if (typeof parsed !== "object" || parsed === null) return fallback;
  const record = parsed as Record<string, unknown>;
  if (record.hm !== SCHEMA_VERSION) return fallback;

  const title = readField(record.title);
  if (!title) return fallback;

  return {
    title,
    reportType: readField(record.type),
    labName: readField(record.lab),
    specimenDate: readField(record.specimenDate),
    patientPseudonym: readField(record.patient),
    isStructured: true,
  };
}

/**
 * Format a specimen date for display.
 *
 * @param iso - Date as `YYYY-MM-DD`.
 * @returns e.g. `"12 Jul 2026"`, or the raw input when it is not a plain date.
 */
export function formatSpecimenDate(iso: string): string {
  if (!SPECIMEN_DATE_PATTERN.test(iso)) return iso;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** A fresh synthetic patient pseudonym, e.g. `SYN-4821`. */
export function randomPatientPseudonym(): string {
  return `SYN-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** Extension to suggest for a downloaded report, derived from its MIME type. */
const EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "text/csv": "csv",
  "text/plain": "txt",
  "application/json": "json",
};

/**
 * Build the file name a downloaded report is saved as.
 *
 * The registry `name` holds encoded JSON, which would make a terrible file
 * name, so the download uses a slug of the decoded title plus the patient
 * pseudonym.
 *
 * @param rawName - The registry `name` field.
 * @param mimeType - The report's MIME type, used to pick an extension.
 * @returns A safe download file name, e.g. `complete-blood-count-syn-4821.pdf`.
 */
export function downloadFileName(rawName: string, mimeType: string): string {
  const report = decodeReportName(rawName);
  const extension = EXTENSION_BY_MIME[mimeType.split(";")[0].trim().toLowerCase()];

  // Reports registered before this encoding carry a plain file name as their
  // title, so drop a redundant extension rather than slugifying it into the slug.
  const title = extension ? report.title.replace(new RegExp(`\\.${extension}$`, "i"), "") : report.title;

  const slug =
    [title, report.patientPseudonym]
      .filter(Boolean)
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "lab-report";

  return extension ? `${slug}.${extension}` : slug;
}

/** Trim an untrusted on-chain string to a renderable length. */
function clamp(value: string): string {
  return value.slice(0, MAX_FIELD_LENGTH);
}

/** Read one field from parsed JSON, tolerating any type. */
function readField(value: unknown): string {
  return typeof value === "string" ? clamp(value.trim()) : "";
}
