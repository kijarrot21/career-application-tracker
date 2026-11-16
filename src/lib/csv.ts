/**
 * RFC 4180 CSV serializer with spreadsheet formula-injection protection.
 * Any cell whose trimmed value begins with `=`, `+`, `-`, `@`, `\t`, or `\r`
 * is prefixed with a single quote (`'`) unless it is a plain negative number.
 */

const DANGEROUS_PREFIX = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  const trimmed = str.trimStart();
  if (DANGEROUS_PREFIX.test(trimmed) && !PLAIN_NUMBER.test(trimmed)) {
    return `'${str}`;
  }
  return str;
}

export function encodeCsvField(value: unknown): string {
  const safe = sanitizeCsvCell(value);
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  const headLine = headers.map(encodeCsvField).join(",");
  const bodyLines = rows.map((row) => row.map(encodeCsvField).join(","));
  return [headLine, ...bodyLines].join("\r\n") + "\r\n";
}
