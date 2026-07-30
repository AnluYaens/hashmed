import type { LabReportMeta } from "./reportMetadata";

/**
 * Synthetic lab reports shipped with HashMed.
 *
 * These exist so the pay-per-read flow can be demonstrated end to end without
 * anyone supplying a document. Every value is invented: the labs do not exist,
 * the patients are pseudonyms, and the results were made up to look plausible.
 * Nothing here is, or is derived from, a real medical record.
 *
 * This module is the single source of truth for both sides of a sample: the
 * publish page reads `path` / `meta` to prefill the form, and
 * `scripts/make-sample-reports.ts` reads `panel` to render the matching PDF
 * into `public/samples`.
 */

/** One row of a lab panel, as printed in the generated PDF. */
export type SamplePanelRow = {
  analyte: string;
  result: string;
  unit: string;
  reference: string;
};

/** A shipped synthetic report: the PDF plus the metadata that describes it. */
export type SampleReport = {
  /** Stable id, used as the picker's option value. */
  id: string;
  /** File name of the generated PDF, also used when loading it into the form. */
  fileName: string;
  /** Public path the browser fetches the PDF from. */
  path: string;
  /** Metadata prefilled into the publish form. */
  meta: LabReportMeta;
  /** Result rows rendered into the PDF. */
  panel: SamplePanelRow[];
};

export const SAMPLE_REPORTS: SampleReport[] = [
  {
    id: "cbc",
    fileName: "hashmed-cbc-syn-4821.pdf",
    path: "/samples/hashmed-cbc-syn-4821.pdf",
    meta: {
      title: "Complete Blood Count",
      reportType: "CBC",
      labName: "Northwind Reference Lab",
      specimenDate: "2026-07-12",
      patientPseudonym: "SYN-4821",
    },
    panel: [
      { analyte: "White Blood Cells", result: "6.4", unit: "10^9/L", reference: "4.0 - 11.0" },
      { analyte: "Red Blood Cells", result: "4.8", unit: "10^12/L", reference: "4.2 - 5.9" },
      { analyte: "Haemoglobin", result: "14.1", unit: "g/dL", reference: "13.0 - 17.0" },
      { analyte: "Haematocrit", result: "42.0", unit: "%", reference: "38.0 - 50.0" },
      { analyte: "Platelets", result: "244", unit: "10^9/L", reference: "150 - 400" },
      { analyte: "Neutrophils", result: "58", unit: "%", reference: "40 - 70" },
    ],
  },
  {
    id: "lipid",
    fileName: "hashmed-lipid-syn-3390.pdf",
    path: "/samples/hashmed-lipid-syn-3390.pdf",
    meta: {
      title: "Lipid Panel",
      reportType: "LIPID",
      labName: "Cedar Fork Diagnostics",
      specimenDate: "2026-06-28",
      patientPseudonym: "SYN-3390",
    },
    panel: [
      { analyte: "Total Cholesterol", result: "192", unit: "mg/dL", reference: "< 200" },
      { analyte: "HDL Cholesterol", result: "54", unit: "mg/dL", reference: "> 40" },
      { analyte: "LDL Cholesterol", result: "118", unit: "mg/dL", reference: "< 130" },
      { analyte: "Triglycerides", result: "101", unit: "mg/dL", reference: "< 150" },
      { analyte: "Non-HDL Cholesterol", result: "138", unit: "mg/dL", reference: "< 160" },
    ],
  },
  {
    id: "hba1c",
    fileName: "hashmed-hba1c-syn-7712.pdf",
    path: "/samples/hashmed-hba1c-syn-7712.pdf",
    meta: {
      title: "Hemoglobin A1c",
      reportType: "HBA1C",
      labName: "Blue Harbor Pathology",
      specimenDate: "2026-07-05",
      patientPseudonym: "SYN-7712",
    },
    panel: [
      { analyte: "Haemoglobin A1c", result: "5.4", unit: "%", reference: "4.0 - 5.6" },
      { analyte: "Estimated Average Glucose", result: "108", unit: "mg/dL", reference: "70 - 126" },
      { analyte: "Fasting Glucose", result: "94", unit: "mg/dL", reference: "70 - 99" },
    ],
  },
];

/** Look up a shipped sample by its id. */
export function getSampleReport(id: string): SampleReport | undefined {
  return SAMPLE_REPORTS.find(sample => sample.id === id);
}
