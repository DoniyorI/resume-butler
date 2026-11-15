// One-off: compile the synthetic resume in tests/fixtures/readability-resume.mjs to
// tests/fixtures/readability-resume.pdf through the app's own LaTeX + compile path.
// node --use-system-ca --import ./tests/register.mjs scripts/build-readability-fixture.mjs
import { writeFile } from "node:fs/promises";
import { generateLatex } from "@/server/latex";
import { compilePdf } from "@/server/resume/renderResume";
import { readabilityResume } from "../tests/fixtures/readability-resume.mjs";

const pdf = await compilePdf(generateLatex(readabilityResume));
if (!pdf) throw new Error("Compilation failed");
await writeFile(new URL("../tests/fixtures/readability-resume.pdf", import.meta.url), Buffer.from(pdf));
console.log(`wrote ${pdf.byteLength} bytes`);
