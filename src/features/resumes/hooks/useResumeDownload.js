import { useState } from "react";
import { toast } from "sonner";

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Download the resume as PDF or .tex. `flush` (from useResumeDocument) saves
// pending edits first, since the route renders the stored resume.
export function useResumeDownload({ resumeId, title, flush }) {
  const [downloading, setDownloading] = useState(false);

  const download = async (format) => {
    setDownloading(true);
    try {
      // If saving failed the save toast already explains why; don't download stale content
      if (!(await flush())) return;
      const response = await fetch("/api/download-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, format }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to download resume");
      }

      // PDF compilation falls back to the .tex source when it fails
      const isTex = response.headers.get("Content-Type")?.includes("x-tex") || format === "tex";
      const extension = isTex ? "tex" : "pdf";
      saveBlob(await response.blob(), `${title || "resume"}.${extension}`);

      if (isTex && format === "pdf") {
        toast("PDF compilation unavailable — downloaded .tex file instead. Open it in Overleaf to compile.");
      } else {
        toast(`Resume downloaded as .${extension}`);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDownloading(false);
    }
  };

  return { download, downloading };
}
