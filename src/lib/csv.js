// CSV reading and writing, safe on client and server. Pure: no imports.

const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);
const BOM = "﻿";

function cell(value) {
  let text = value == null ? "" : String(value);
  // A spreadsheet runs a cell that starts with one of these as a formula
  if (text !== "" && FORMULA_TRIGGERS.has(text[0])) text = `'${text}`;
  if (/[",\r\n]/.test(text) || /^\s|\s$/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

// rows: an array of arrays of values. CRLF line ends, a UTF-8 BOM so Excel
// reads the file as UTF-8, and formula-looking cells neutralised with a quote.
export function toCsv(rows) {
  const lines = [];
  for (const row of rows) {
    const cells = [];
    for (const value of row) cells.push(cell(value));
    lines.push(cells.join(","));
  }
  return BOM + lines.join("\r\n") + (lines.length ? "\r\n" : "");
}

// Undoes the guard toCsv adds, so a file we wrote reads back unchanged
export function unguardFormula(value) {
  if (typeof value !== "string" || value.length < 2 || value[0] !== "'") return value;
  return "=+-@".includes(value[1]) ? value.slice(1) : value;
}

// Counts , ; and tab outside quotes in the first record
function detectDelimiter(text) {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === "\n" || ch === "\r") break;
      if (ch in counts) counts[ch]++;
    }
  }
  let best = ",";
  for (const candidate of [";", "\t"]) if (counts[candidate] > counts[best]) best = candidate;
  return best;
}

// One pass over the text. Fields are cut out with slice and indexOf, never
// built a character at a time, so a 1 MB cell costs about 1 MB of work.
export function parseCsv(input, { maxRows = 5000, maxColumns = 60 } = {}) {
  let text = String(input ?? "");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delimiter = detectDelimiter(text);
  const delimiterCode = delimiter.charCodeAt(0);
  const length = text.length;
  const rows = [];
  let truncated = false;
  let columnsDropped = false;
  let row = [];
  let i = 0;

  while (length > 0) {
    // One field
    let field;
    if (text.charCodeAt(i) === 34) {
      const parts = [];
      i++;
      for (;;) {
        const quote = text.indexOf('"', i);
        if (quote === -1) { parts.push(text.slice(i)); i = length; break; } // unterminated: take the rest
        parts.push(text.slice(i, quote));
        if (text.charCodeAt(quote + 1) === 34) { parts.push('"'); i = quote + 2; }
        else { i = quote + 1; break; }
      }
      // Stray text after the closing quote is kept rather than dropped
      const start = i;
      while (i < length) {
        const code = text.charCodeAt(i);
        if (code === delimiterCode || code === 10 || code === 13) break;
        i++;
      }
      if (i > start) parts.push(text.slice(start, i));
      field = parts.join("");
    } else {
      const start = i;
      while (i < length) {
        const code = text.charCodeAt(i);
        if (code === delimiterCode || code === 10 || code === 13) break;
        i++;
      }
      field = text.slice(start, i);
    }
    if (row.length < maxColumns) row.push(field);
    else columnsDropped = true;

    if (i < length && text.charCodeAt(i) === delimiterCode) { i++; continue; }

    // End of record
    if (i < length) i += text.charCodeAt(i) === 13 && text.charCodeAt(i + 1) === 10 ? 2 : 1;
    if (row.some((value) => value !== "")) rows.push(row);
    row = [];
    if (rows.length >= maxRows) {
      truncated = i < length && /\S/.test(text.slice(i));
      break;
    }
    if (i >= length) break;
  }
  return { rows, delimiter, truncated, columnsDropped };
}
