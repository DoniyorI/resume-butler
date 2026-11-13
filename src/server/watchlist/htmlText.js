import "server-only";

// Job boards return descriptions as HTML. Turn it into plain text we can show
// and score. The output is only ever rendered as text, never as HTML.
//
// Everything here is a single forward scan (no regex that can backtrack), so a
// megabyte of "<" or unclosed tags costs time proportional to its length.

const NAMED = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•",
  middot: "·", copy: "©", reg: "®", trade: "™",
};
const MAX_ENTITY = 10; // longest we look for ";" after "&"

// A code point we are willing to output: not a control character, surrogate or out of range
function validCodePoint(code) {
  if (!Number.isInteger(code) || code < 0x20 || code > 0x10ffff) return code === 9 || code === 10 || code === 13;
  if (code >= 0x7f && code <= 0x9f) return false;
  if (code >= 0xd800 && code <= 0xdfff) return false;
  return code !== 0xfffe && code !== 0xffff;
}

// Everything that reaches the database goes through this: no NUL or other
// control characters (new lines and tabs stay), no lone surrogates, and a cut
// to `max` that never splits a surrogate pair.
const CONTROLS = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;
export function cleanText(value, max = Infinity) {
  if (typeof value !== "string") return "";
  let text = value.replace(CONTROLS, "").toWellFormed();
  if (text.length > max) {
    text = text.slice(0, max);
    const last = text.charCodeAt(text.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) text = text.slice(0, -1); // half of a pair
  }
  return text;
}

/**
 * Decode named (the common ones) and numeric HTML entities in one pass.
 * Unknown names are left as written; invalid numeric ones are dropped.
 * The result is not decoded again by anything.
 */
export function decodeEntities(text) {
  if (typeof text !== "string" || !text.includes("&")) return typeof text === "string" ? text : "";
  let out = "";
  let from = 0;
  let amp = text.indexOf("&");
  while (amp !== -1) {
    out += text.slice(from, amp);
    let end = -1;
    const limit = Math.min(text.length, amp + MAX_ENTITY + 2);
    for (let i = amp + 1; i < limit; i++) {
      if (text[i] === ";") { end = i; break; }
    }
    let replacement = null;
    if (end !== -1) {
      const body = text.slice(amp + 1, end);
      if (body[0] === "#") {
        const hex = body[1] === "x" || body[1] === "X";
        const digits = hex ? body.slice(2) : body.slice(1);
        if (digits && (hex ? /^[0-9a-fA-F]{1,6}$/ : /^[0-9]{1,7}$/).test(digits)) {
          const code = parseInt(digits, hex ? 16 : 10);
          replacement = validCodePoint(code) ? String.fromCodePoint(code) : "";
        }
      } else if (Object.hasOwn(NAMED, body)) {
        replacement = NAMED[body];
      }
    }
    if (replacement === null) {
      out += "&";
      from = amp + 1;
    } else {
      out += replacement;
      from = end + 1;
    }
    amp = text.indexOf("&", from);
  }
  return out + text.slice(from);
}

// Paragraph-like blocks are set off by a blank line; headings, lists and rows just start a new line
const SPACED = new Set(["p", "div", "section", "table", "blockquote"]);
const LINED = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "tr"]);
const isLetter = (c) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
const isNameChar = (c) => isLetter(c) || (c >= "0" && c <= "9");

// Find "</name" (any case) at or after `from`; returns the index of its "<" or -1
function findClose(html, name, from) {
  let at = html.indexOf("</", from);
  while (at !== -1) {
    if (html.slice(at + 2, at + 2 + name.length).toLowerCase() === name) return at;
    at = html.indexOf("</", at + 2);
  }
  return -1;
}

/**
 * HTML to plain text: script and style removed with their content, block
 * elements on their own lines, list items as "- " lines, every other tag
 * dropped, entities decoded once. Capped at `max` characters.
 */
export function htmlToText(html, { max = 20000 } = {}) {
  if (typeof html !== "string" || !html) return "";
  html = cleanText(html); // a NUL inside a tag name must not hide a tag from the scan below
  const parts = [];
  let length = 0;
  let tail = "\n\n"; // the last two characters written; the start of the text counts as a blank line
  const push = (piece) => {
    parts.push(piece);
    length += piece.length;
    tail = (tail + piece).slice(-2);
  };
  const line = () => { if (!tail.endsWith("\n")) push("\n"); };
  const blank = () => { line(); if (tail !== "\n\n") push("\n"); };
  const lastGt = html.lastIndexOf(">");
  const n = html.length;
  let i = 0;
  let textFrom = 0;
  const flushText = (to) => {
    if (to <= textFrom) return;
    let chunk = decodeEntities(html.slice(textFrom, to)).replace(/\s+/g, " ");
    if (tail.endsWith("\n")) chunk = chunk.trimStart(); // no leading space at the start of a line
    if (chunk) push(chunk);
  };

  while (i < n && length < max * 2) {
    const lt = html.indexOf("<", i);
    if (lt === -1 || lt > lastGt) break; // no tag can end after this point: the rest is text
    const next = html[lt + 1];
    if (!(isLetter(next) || next === "/" || next === "!")) { i = lt + 1; continue; } // "a < b" is text
    flushText(lt);

    if (next === "!") {
      // A comment or doctype: skip to its end; an unterminated one drops the rest
      const close = html.startsWith("<!--", lt) ? html.indexOf("-->", lt + 4) : html.indexOf(">", lt);
      if (close === -1) { textFrom = n; i = n; break; }
      i = textFrom = close + (html.startsWith("<!--", lt) ? 3 : 1);
      continue;
    }

    const gt = html.indexOf(">", lt);
    const closing = next === "/";
    let nameEnd = lt + (closing ? 2 : 1);
    while (nameEnd < gt && isNameChar(html[nameEnd])) nameEnd++;
    const name = html.slice(lt + (closing ? 2 : 1), nameEnd).toLowerCase();
    i = textFrom = gt + 1;

    if (!closing && (name === "script" || name === "style") && html[gt - 1] !== "/") {
      const close = findClose(html, name, i);
      if (close === -1) { textFrom = n; i = n; break; }
      const closeGt = html.indexOf(">", close);
      i = textFrom = closeGt === -1 ? n : closeGt + 1;
    } else if (name === "br") {
      push("\n");
    } else if (name === "li") {
      if (!closing) { line(); push("- "); }
    } else if (SPACED.has(name)) {
      blank();
    } else if (LINED.has(name)) {
      line();
    }
  }
  if (length < max * 2) flushText(n);

  const out = parts
    .join("")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter((line) => line !== "-")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleanText(out, max).trimEnd();
}
