import { NextResponse } from "next/server";
import { z } from "zod";
import { generateLatex } from "@/server/latex";
import { requireUser } from "@/server/auth";
import { errorResponse, parseJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rateLimit";

const bodySchema = z.object({
  resumeId: z.string().uuid(),
  format: z.enum(["tex", "pdf"]).optional(),
});

// Build a Content-Disposition header that a resume title can't break out of
function attachment(title, extension) {
  const base = (title || "resume").replace(/[^\w .-]/g, "").trim().slice(0, 100) || "resume";
  const filename = `${base}.${extension}`;
  return `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function texResponse(latex, title) {
  return new NextResponse(latex, {
    headers: {
      "Content-Type": "application/x-tex",
      "Content-Disposition": attachment(title, "tex"),
    },
  });
}

export async function POST(request) {
  try {
    const { supabase, user } = await requireUser();
    const { resumeId, format: outputFormat } = await parseJson(request, bodySchema);
    await enforceRateLimit(supabase, "download-resume");

    // Fetch the resume
    const { data: resume, error } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", resumeId)
      .eq("user_id", user.id)
      .single();

    if (error || !resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const latex = generateLatex(resume.content || {});

    // If user just wants .tex file
    if (outputFormat === "tex") {
      return texResponse(latex, resume.title);
    }

    // Compile to PDF using YtoTech LaTeX-on-HTTP API
    // https://github.com/YtoTech/latex-on-http
    const compileResponse = await fetch("https://latex.ytotech.com/builds/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compiler: "pdflatex",
        resources: [
          {
            main: true,
            content: latex,
          },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!compileResponse.ok) {
      console.error("LaTeX compilation failed:", await compileResponse.text());
      // Fallback: return .tex file
      return texResponse(latex, resume.title);
    }

    const pdfBuffer = await compileResponse.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": attachment(resume.title, "pdf"),
      },
    });
  } catch (error) {
    return errorResponse(error, "Error generating resume");
  }
}
