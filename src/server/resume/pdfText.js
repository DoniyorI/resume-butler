import "server-only";
import PDFParser from "pdf2json";

// pdf2json separates pages with a marker line like "----------------Page (0) Break----------------"
const PAGE_BREAK = /^-{4,}Page \(\d+\) Break-{4,}$/;

/**
 * The text a PDF text extractor reads from a PDF, one string per page.
 * Rejects when the file cannot be parsed.
 */
export function extractPdfPages(buffer) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);
    pdfParser.on("pdfParser_dataReady", () => {
      const pages = [[]];
      for (const line of pdfParser.getRawTextContent().split(/\r?\n/)) {
        if (PAGE_BREAK.test(line.trim())) pages.push([]);
        else pages.at(-1).push(line);
      }
      // The marker also follows the last page; drop the empty tail it leaves
      if (pages.length > 1 && pages.at(-1).every((line) => !line.trim())) pages.pop();
      resolve(pages.map((lines) => lines.join("\n").trim()));
    });
    pdfParser.on("pdfParser_dataError", (errData) => reject(new Error(errData.parserError)));
    pdfParser.parseBuffer(buffer);
  });
}

/** All of a PDF's text as one string, without pdf2json's page-break marker lines. */
export async function extractPdfText(buffer) {
  return (await extractPdfPages(buffer)).join("\n");
}
