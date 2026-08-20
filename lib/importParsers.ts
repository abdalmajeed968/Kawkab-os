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

export function parseCsv(buffer: Buffer): ParsedFile {
  const text = buffer.toString("utf-8");
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (result.errors.length > 0) {
    const first = result.errors[0];
    throw new Error(`CSV parse error at row ${first.row}: ${first.message}`);
  }
  const headers = result.meta.fields ?? [];
  return { rows: result.data, headers };
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
  if (lower.endsWith(".csv")) return parseCsv(buffer);
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return parseExcel(buffer);
  throw new Error(`Unsupported file type: ${filename}. Upload a .csv, .xlsx, or .xls file.`);
}
