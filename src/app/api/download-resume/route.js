import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateLatex } from "@/lib/generateLatex";

export async function POST(request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { resumeId, format: outputFormat } = await request.json();

    if (!resumeId) {
      return NextResponse.json({ error: "resumeId is required" }, { status: 400 });
    }

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

    const content = resume.content || {};
    const latex = generateLatex(content);

    // If user just wants .tex file
    if (outputFormat === "tex") {
      return new NextResponse(latex, {
        headers: {
          "Content-Type": "application/x-tex",
          "Content-Disposition": `attachment; filename="${resume.title || "resume"}.tex"`,
        },
      });
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
    });

    if (!compileResponse.ok) {
      const errorText = await compileResponse.text();
      console.error("LaTeX compilation failed:", errorText);
      // Fallback: return .tex file
      return new NextResponse(latex, {
        headers: {
          "Content-Type": "application/x-tex",
          "Content-Disposition": `attachment; filename="${resume.title || "resume"}.tex"`,
        },
      });
    }

    const pdfBuffer = await compileResponse.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${resume.title || "resume"}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating resume:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate resume" },
      { status: 500 }
    );
  }
}
