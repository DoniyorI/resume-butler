import assert from "node:assert/strict";
import { test } from "node:test";

const { toCsv, parseCsv, unguardFormula } = await import("@/lib/csv");

const roundTrip = (rows) => parseCsv(toCsv(rows)).rows.map((row) => row.map(unguardFormula));

test("toCsv writes a BOM, CRLF line ends and quotes only where needed", () => {
  const csv = toCsv([["a", "b,c", 'say "hi"', "two\nlines", null, undefined, " pad "]]);
  assert.equal(csv, '﻿a,"b,c","say ""hi""","two\nlines",,,\" pad \"\r\n');
  assert.equal(toCsv([["x"], ["y"]]), "﻿x\r\ny\r\n");
});

test("values survive a round trip", () => {
  const rows = [
    ["Company", "Notes"],
    ["Acme, Inc.", 'He said "call me"'],
    ["Line\nbreak", "cr\r\nlf"],
    ["Zoë – 東京 – 🚀", "  leading"],
    ["trailing  ", "plain"],
    ["", "only second"],
    ["=SUM(A1)", "-5"],
    ["+1", "@home"],
  ];
  assert.deepEqual(roundTrip(rows), rows);
});

test("the formula guard covers = + - @ tab and CR", () => {
  for (const trigger of ["=", "+", "-", "@", "\t", "\r"]) {
    const csv = toCsv([[`${trigger}x`]]);
    assert.ok(csv.slice(1).startsWith(`'${trigger}x`) || csv.slice(1).startsWith(`"'${trigger}x`), JSON.stringify(csv));
  }
  assert.equal(toCsv([["a=b"]]), "﻿a=b\r\n");
  assert.equal(unguardFormula("'=1"), "=1");
  assert.equal(unguardFormula("'-1"), "-1");
  assert.equal(unguardFormula("'hello"), "'hello");
  assert.equal(unguardFormula("'"), "'");
  assert.equal(unguardFormula("=1"), "=1");
});

test("each delimiter is detected, ignoring ones inside quotes", () => {
  assert.deepEqual(parseCsv("a,b,c\n1,2,3"), { rows: [["a", "b", "c"], ["1", "2", "3"]], delimiter: ",", truncated: false, columnsDropped: false });
  const semi = parseCsv('a;b;c\n1;"x;y";3');
  assert.equal(semi.delimiter, ";");
  assert.deepEqual(semi.rows, [["a", "b", "c"], ["1", "x;y", "3"]]);
  const tab = parseCsv("a\tb\tc\n1\t2\t3");
  assert.equal(tab.delimiter, "\t");
  assert.deepEqual(tab.rows[1], ["1", "2", "3"]);
  // Commas only inside quotes in the header: the semicolon wins
  assert.equal(parseCsv('"a,b,c,d";e\n1;2').delimiter, ";");
});

test("a BOM, CRLF, LF and lone CR line ends are accepted; empty records are skipped", () => {
  assert.deepEqual(parseCsv("﻿a,b\r\n1,2\r\n\r\n3,4\r\n").rows, [["a", "b"], ["1", "2"], ["3", "4"]]);
  assert.deepEqual(parseCsv("a,b\r1,2\r3,4").rows, [["a", "b"], ["1", "2"], ["3", "4"]]);
  assert.deepEqual(parseCsv("a,b\n\n\n1,2").rows, [["a", "b"], ["1", "2"]]);
  assert.deepEqual(parseCsv("").rows, []);
  assert.deepEqual(parseCsv("a,b,").rows, [["a", "b", ""]]);
});

test("quoted fields hold delimiters, newlines and doubled quotes", () => {
  assert.deepEqual(parseCsv('"a,b","c\nd","e""f"').rows, [["a,b", "c\nd", 'e"f']]);
});

test("an unterminated quote takes the rest of the text", () => {
  assert.deepEqual(parseCsv('a,"b\nc,d').rows, [["a", "b\nc,d"]]);
  assert.doesNotThrow(() => parseCsv('"'));
});

test("maxRows and maxColumns cap the result", () => {
  const text = Array.from({ length: 10 }, (_, i) => `${i},x,y,z`).join("\n");
  const capped = parseCsv(text, { maxRows: 3, maxColumns: 2 });
  assert.equal(capped.rows.length, 3);
  assert.deepEqual(capped.rows[2], ["2", "x"]);
  assert.equal(capped.truncated, true);
  assert.equal(parseCsv("1\n2\n3\n", { maxRows: 3 }).truncated, false);
  assert.equal(parseCsv("1\n2\n3\n\n  \n", { maxRows: 3 }).truncated, false);
});

test("a 1 MB input parses in one linear pass", () => {
  const big = "x".repeat(1_000_000);
  let started = performance.now();
  const quoted = parseCsv(`"${big.replace(/x{1000}/g, '""' + "x".repeat(998))}",b\nc,d`);
  assert.equal(quoted.rows.length, 2);
  assert.ok(performance.now() - started < 500);

  started = performance.now();
  const many = Array.from({ length: 50_000 }, (_, i) => `${i},"q ""${i}"" z",w`).join("\r\n");
  const parsed = parseCsv(many, { maxRows: 100_000 });
  assert.equal(parsed.rows.length, 50_000);
  assert.ok(performance.now() - started < 500);

  started = performance.now();
  assert.equal(parseCsv(`"${big}`).rows[0][0].length, 1_000_000);
  assert.equal(parseCsv(big).rows[0][0].length, 1_000_000);
  assert.ok(performance.now() - started < 500);
});

test("columnsDropped reports fields cut by maxColumns", () => {
  assert.equal(parseCsv("a,b,c\n1,2,3", { maxColumns: 2 }).columnsDropped, true);
  assert.equal(parseCsv("a,b\n1,2", { maxColumns: 2 }).columnsDropped, false);
});
