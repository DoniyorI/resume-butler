import { useState } from "react";
import { toast } from "sonner";

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Download the document as PDF or .tex. `flush` (from the editor's document
// hook) saves pending edits first, since the route renders the stored copy.
// Cover letters pass their own `endpoint` and request `body`.
export function useResumeDownload({
  resumeId,
  title,
  flush,
  endpoint = "/api/download-resume",
  body = { resumeId },
  noun = "Resume",
}) {
  const [downloading, setDownloading] = useState(false);

  const download = async (format) => {
    setDownloading(true);
    try {
      // The inline save indicator explains a failed save; do not download stale content
      if (!(await flush())) return;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, format }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to download ${noun.toLowerCase()}`);
      }

      // PDF compilation falls back to the .tex source when it fails
      const isTex = response.headers.get("Content-Type")?.includes("x-tex") || format === "tex";
      const extension = isTex ? "tex" : "pdf";
      saveBlob(await response.blob(), `${title || noun.toLowerCase()}.${extension}`);

      if (isTex && format === "pdf") {
        toast("PDF compilation unavailable — downloaded .tex file instead. Open it in Overleaf to compile.");
      } else {
        toast(`${noun} downloaded as .${extension}`);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDownloading(false);
    }
  };

  return { download, downloading };
}
