"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadExport } from "@/features/profile/downloadExport";

// Download everything the account holds, or just the applications
export default function DataExport() {
  const [busy, setBusy] = useState(null);

  const run = async (format) => {
    setBusy(format);
    try {
      const { summary } = await downloadExport(format);
      toast.success("Download started");
      const notes = [];
      if (summary?.incomplete?.length) notes.push(`could not be fully read: ${summary.incomplete.join(", ")}`);
      if (summary?.truncated?.length) notes.push(`cut off at the size limit: ${summary.truncated.join(", ")}`);
      if (notes.length) toast.warning(`Your export is not complete. These sections ${notes.join("; ")}.`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-8 rounded-xl border bg-background p-5 sm:p-6" aria-labelledby="your-data">
      <h2 id="your-data" className="text-base font-semibold">Your data</h2>
      <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
        Download your profile, Master CV, applications, documents, saved jobs, answers and settings. Your email
        password and connection secrets are never included.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy !== null} onClick={() => run("json")}>
          {busy === "json" ? "Preparing…" : "Download everything (JSON)"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => run("csv")}>
          {busy === "csv" ? "Preparing…" : "Download applications (CSV)"}
        </Button>
      </div>
    </section>
  );
}
