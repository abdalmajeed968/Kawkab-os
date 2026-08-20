// lib/importParsers.ts
//
// Turns an uploaded file's bytes into an array of plain row objects
// (header name -> cell value), with nothing dropped — every column in
// the file becomes a key in the row object, whether or not today's
// import logic knows what to do with it yet. Column-name mapping to
// Kawkab's own fields (SKU, quantity, price, ...) happens one layer up,
// in lib/salesImport.ts — this module only turns bytes into rows.

import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ParsedFile {
  rows: Record<string, unknown>[];
  headers: string[];
}

// Amazon's own exports (Seller Central "Transaction" reports especially)
// are frequently UTF-8-with-BOM and just as often tab-delimited despite a
// .csv extension. Both are stripped/detected here rather than assumed away
// by the caller — a BOM left in place corrupts the first header's name
// (e.g. "﻿sku" no longer equals "sku"), silently breaking every
// downstream column match.
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseCsv(buffer: Buffer): ParsedFile {
  const text = stripBom(buffer.toString("utf-8"));
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    // Deliberately omitted `delimiter` — Papa Parse auto-detects among
    // comma/tab/pipe/semicolon per file, which is what actually lets the
    // same code path handle both a comma-delimited CSV and a
    // tab-delimited "Transaction" report saved with a .csv extension.
  });
  if (result.errors.length > 0) {
    const first = result.errors[0];
    throw new Error(`CSV parse error at row ${first.row}: ${first.message}`);
  }
  const headers = (result.meta.fields ?? []).map((h) => stripBom(h));
  const rows = result.data.map((row) => {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) cleaned[stripBom(key)] = value;
    return cleaned;
  });
  return { rows, headers };
}

export function parseExcel(buffer: Buffer): ParsedFile {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("The uploaded file has no sheets.");
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { rows, headers };
}

export function parseImportFile(buffer: Buffer, filename: string): ParsedFile {
  const lower = filename.toLowerCase();
  // .txt and .tsv are Amazon's own export extensions for tab-delimited
  // reports (the Transaction report in particular) — same parser as .csv,
  // since Papa Parse auto-detects the delimiter rather than assuming comma.
  if (lower.endsWith(".csv") || lower.endsWith(".txt") || lower.endsWith(".tsv")) return parseCsv(buffer);
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return parseExcel(buffer);
  throw new Error(`Unsupported file type: ${filename}. Upload a .csv, .tsv, .txt, .xlsx, or .xls file.`);
}
