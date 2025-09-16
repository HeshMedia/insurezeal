/* eslint-disable @typescript-eslint/no-explicit-any */
export type Row = Record<string, any>;

const normalizeHeader = (key: string) => key?.toString?.() ?? "";

const normalizeCell = (val: any) => {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
};

// Safe CSV string with quotes and BOM for Excel
export const toCsvString = (rows: Row[], headers?: string[]) => {
  if (!rows || rows.length === 0) return "\uFEFF";
  const cols = headers && headers.length > 0 ? headers : Object.keys(rows || {});
  const escape = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const headerLine = cols.map((h) => escape(normalizeHeader(h))).join(",");
  const lines = rows.map((r) => cols.map((c) => escape(normalizeCell(r[c]))).join(","));
  return "\uFEFF" + [headerLine, ...lines].join("\r\n");
};

export const downloadBlob = (content: BlobPart, filename: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportRowsToCsv = (rows: Row[], filename = "export.csv", headers?: string[]) => {
  const csv = toCsvString(rows, headers);
  downloadBlob(csv, filename, "text/csv;charset=utf-8;");
};

// Excel via SheetJS (xlsx)
export const exportRowsToXlsx = async (rows: Row[], filename = "export.xlsx", sheetName = "Sheet1") => {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(wbout, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
};
