/**
 * Render the synthetic sample lab reports shipped in `public/samples`.
 *
 * The PDFs are generated rather than committed as opaque binaries so it stays
 * obvious that every sample is fabricated: the content comes straight from
 * `utils/hashmed/sampleReports.ts` and the pages are watermarked SYNTHETIC.
 *
 * Writing the PDF by hand keeps the template dependency-free. The format is the
 * minimum a viewer needs: a catalogue, a page tree, one page with two standard
 * Type1 fonts, and one uncompressed content stream. The cross-reference table
 * is built from real byte offsets as the objects are appended.
 *
 * Usage (from `packages/nextjs`):
 *   yarn samples
 */
import { SAMPLE_REPORTS, type SampleReport } from "../utils/hashmed/sampleReports";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 56;
const RIGHT_EDGE = PAGE_WIDTH - MARGIN;

/** Column x-positions for the results table. */
const COLUMNS = { analyte: MARGIN, result: 300, unit: 370, reference: 452 };

/**
 * Escape a string for use inside a PDF literal `(...)` string.
 *
 * The content stream is written as latin1, so typographic characters are folded
 * to ASCII first — otherwise an em dash silently renders as a control byte.
 */
function pdfString(value: string): string {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/[\\()]/g, match => `\\${match}`);
}

/** A `BT … ET` text block drawing one line at an absolute position. */
function text(
  value: string,
  options: { x: number; y: number; font: "F1" | "F2"; size: number; gray?: number },
): string {
  const color = options.gray === undefined ? "" : `${options.gray} ${options.gray} ${options.gray} rg\n`;
  const reset = options.gray === undefined ? "" : "0 0 0 rg\n";
  return `${color}BT /${options.font} ${options.size} Tf 1 0 0 1 ${options.x} ${options.y} Tm (${pdfString(value)}) Tj ET\n${reset}`;
}

/** A horizontal rule across the page body. */
function rule(y: number): string {
  return `0.8 0.8 0.8 RG 1 w ${MARGIN} ${y} m ${RIGHT_EDGE} ${y} l S\n`;
}

/** The diagonal SYNTHETIC watermark laid under the report body. */
function watermark(): string {
  const cos = 0.7071;
  return `q\n0.88 0.88 0.9 rg\nBT /F2 52 Tf ${cos} ${cos} -${cos} ${cos} 118 230 Tm (SYNTHETIC) Tj ET\nQ\n`;
}

/** Build the page content stream for one sample report. */
function buildContentStream(sample: SampleReport): string {
  const { meta, panel } = sample;
  const parts: string[] = [watermark()];

  parts.push(text(meta.labName, { x: MARGIN, y: 782, font: "F2", size: 20 }));
  parts.push(text("HashMed — synthetic demonstration report", { x: MARGIN, y: 764, font: "F1", size: 10, gray: 0.45 }));
  parts.push(rule(752));

  parts.push(text(meta.title, { x: MARGIN, y: 722, font: "F2", size: 15 }));

  const details: [string, string][] = [
    ["Report type", meta.reportType],
    ["Specimen date", meta.specimenDate],
    ["Patient pseudonym", meta.patientPseudonym],
    ["Ordering clinician", "Not applicable (synthetic record)"],
  ];
  details.forEach(([label, value], i) => {
    const y = 698 - i * 16;
    parts.push(text(`${label}:`, { x: MARGIN, y, font: "F1", size: 10, gray: 0.45 }));
    parts.push(text(value, { x: MARGIN + 120, y, font: "F1", size: 10 }));
  });

  const tableTop = 620;
  parts.push(text("Analyte", { x: COLUMNS.analyte, y: tableTop, font: "F2", size: 10 }));
  parts.push(text("Result", { x: COLUMNS.result, y: tableTop, font: "F2", size: 10 }));
  parts.push(text("Unit", { x: COLUMNS.unit, y: tableTop, font: "F2", size: 10 }));
  parts.push(text("Reference", { x: COLUMNS.reference, y: tableTop, font: "F2", size: 10 }));
  parts.push(rule(tableTop - 8));

  panel.forEach((row, i) => {
    const y = tableTop - 26 - i * 20;
    parts.push(text(row.analyte, { x: COLUMNS.analyte, y, font: "F1", size: 10 }));
    parts.push(text(row.result, { x: COLUMNS.result, y, font: "F1", size: 10 }));
    parts.push(text(row.unit, { x: COLUMNS.unit, y, font: "F1", size: 10, gray: 0.45 }));
    parts.push(text(row.reference, { x: COLUMNS.reference, y, font: "F1", size: 10, gray: 0.45 }));
  });

  const footerTop = tableTop - 26 - panel.length * 20 - 22;
  parts.push(rule(footerTop));
  parts.push(
    text("SYNTHETIC DATA — NOT A REAL PATIENT RECORD.", { x: MARGIN, y: footerTop - 20, font: "F2", size: 9 }),
  );
  parts.push(
    text("Generated for the HashMed x402 pay-per-read demo. Not for clinical use.", {
      x: MARGIN,
      y: footerTop - 34,
      font: "F1",
      size: 9,
      gray: 0.45,
    }),
  );

  return parts.join("");
}

/**
 * Assemble a single-page PDF around a content stream.
 *
 * Offsets are recorded as each object is appended so the cross-reference table
 * and `startxref` point at real byte positions — viewers reject the file
 * otherwise.
 */
function buildPdf(contentStream: string): Buffer {
  const content = Buffer.from(contentStream, "latin1");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];

  const chunks: Buffer[] = [];
  const offsets: number[] = [];
  let size = 0;
  const append = (chunk: Buffer | string) => {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk, "latin1") : chunk;
    chunks.push(buffer);
    size += buffer.length;
  };

  append("%PDF-1.4\n");
  objects.forEach((body, i) => {
    offsets.push(size);
    append(`${i + 1} 0 obj\n${body}\nendobj\n`);
  });

  offsets.push(size);
  append(`${objects.length + 1} 0 obj\n<< /Length ${content.length} >>\nstream\n`);
  append(content);
  append("\nendstream\nendobj\n");

  const xrefOffset = size;
  const total = offsets.length + 1;
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  append(xref);
  append(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.concat(chunks);
}

async function main() {
  // `yarn samples` runs with the package root as cwd (directly or via `yarn workspace`).
  const outputDir = join(process.cwd(), "public", "samples");
  await mkdir(outputDir, { recursive: true });

  for (const sample of SAMPLE_REPORTS) {
    const pdf = buildPdf(buildContentStream(sample));
    await writeFile(join(outputDir, sample.fileName), pdf);
    console.log(`[samples] wrote ${sample.fileName} (${pdf.length} bytes)`);
  }
}

main().catch(error => {
  console.error("[samples]", error instanceof Error ? error.message : error);
  process.exit(1);
});
