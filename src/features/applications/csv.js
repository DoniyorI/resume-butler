const CSV_HEADERS = ["Company", "Role", "Status", "Location", "Date", "Comments", "Portal Link"];

// Quote every cell, escape quotes, and neutralize leading =, +, -, @ so a
// spreadsheet doesn't run synced email content as a formula.
function csvCell(value) {
  let text = String(value ?? "").replace(/\r?\n/g, " ");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function applicationsToCsv(applications) {
  const rows = applications.map((app) => [
    app.companyName,
    app.role,
    app.status,
    app.location,
    app.date,
    app.comments,
    app.portalLink,
  ]);
  return [CSV_HEADERS, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadCsv(csv, filename) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
