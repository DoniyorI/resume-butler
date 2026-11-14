const FALLBACK_ERROR = "Could not prepare your download. Please try again.";

function filenameFrom(response, fallback) {
  const match = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") || "");
  return match ? match[1] : fallback;
}

// Fetches /api/export, saves the body as a file and returns { filename,
// summary } (summary is the export's own report for the JSON, else null).
// Throws an Error with the server's message when the request fails.
export async function downloadExport(format) {
  const csv = format === "csv";
  const response = await fetch(csv ? "/api/export?format=csv" : "/api/export");
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || FALLBACK_ERROR);
  }
  // A stream cut off part-way arrives as a failed body or as broken JSON:
  // neither is saved as if it were a complete export
  const blob = await response.blob().catch(() => {
    throw new Error(FALLBACK_ERROR);
  });
  let summary = null;
  if (!csv) {
    try {
      summary = JSON.parse(await blob.text()).summary || null;
    } catch {
      throw new Error(FALLBACK_ERROR);
    }
  }
  const filename = filenameFrom(response, csv ? "resume-butler-applications.csv" : "resume-butler-export.json");

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { filename, summary };
}
