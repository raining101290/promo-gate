/** RFC 4180 CSV with spreadsheet formula-injection protection. */

type Cell = string | number | null | undefined;

function cell(v: Cell): string {
  if (v == null) return "";
  let s = String(v);
  // A cell starting with = + - @ (or tab/CR) is executed as a formula by Excel/Sheets: neutralise it.
  // Numbers are passed as numbers, so negative amounts aren't affected.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CRLF line endings + UTF-8 BOM so Excel opens Bangla/Unicode text correctly. */
export function toCsv(rows: Cell[][]): string {
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** Paisa -> "1000.00" (plain decimal for spreadsheets; no currency sign or grouping). */
export function csvMoney(paisa: number): string {
  return (paisa / 100).toFixed(2);
}
