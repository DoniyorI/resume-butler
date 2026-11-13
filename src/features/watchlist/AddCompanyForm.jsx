"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { watchCompany } from "./actions";

const field = "w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-60";

export default function AddCompanyForm() {
  const router = useRouter();
  const [values, setValues] = useState({ link: "", keywords: "", name: "" });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const update = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const result = await watchCompany({ link: values.link, keywords: values.keywords, name: values.name.trim() || undefined });
      if (!result.ok) { setError(result.error); return; }
      const { company, added = 0, error: boardError } = result.data;
      if (boardError) toast.warning(`Watching ${company.name}, but: ${boardError}`);
      else toast.success(`Watching ${company.name}. Kept ${added} open ${added === 1 ? "role" : "roles"}.`);
      setValues({ link: "", keywords: "", name: "" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="font-semibold">Watch a company</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs font-medium sm:col-span-2">
          Job board link
          <input name="link" required value={values.link} onChange={update} disabled={busy} maxLength={300} className={field}
            placeholder="https://jobs.ashbyhq.com/company, https://jobs.lever.co/company, greenhouse:company" />
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Job titles to keep
          <input name="keywords" value={values.keywords} onChange={update} disabled={busy} maxLength={2000} className={field} placeholder="engineer, data, product" />
          <span className="block font-normal text-muted-foreground">Leave empty to keep the 100 newest roles</span>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Name (optional)
          <input name="name" value={values.name} onChange={update} disabled={busy} maxLength={200} className={field} placeholder="Taken from the board when empty" />
        </label>
      </div>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <button disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60">
        <Plus size={15} />{busy ? "Reading the board…" : "Watch company"}
      </button>
    </form>
  );
}
