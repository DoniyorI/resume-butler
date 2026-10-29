"use client";
import { createContext, useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { saveCustomCvSections } from "./customSectionActions";

const Context = createContext(null);
const input = "w-full rounded-lg border bg-background px-3 py-2 text-sm font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-60";
const blank = () => ({ id: crypto.randomUUID(), title: "", subtitle: "", date: "", location: "", url: "", text: "", description: [] });

export function CvSectionsProvider({ initialSettings, children }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const revision = useRef(initialSettings.revision), saving = useRef(false);
  async function save(next) {
    if (saving.current) return false;
    saving.current = true; setBusy(true); setError("");
    try {
      const result = await saveCustomCvSections({ ...next, revision: revision.current });
      if (!result.ok) { setError(result.error); return false; }
      revision.current = result.data.revision;
      setSettings({ ...next, revision: revision.current });
      router.refresh(); return true;
    } catch { setError("Not saved. Check your connection and try again; your edits are still here."); return false; }
    finally { saving.current = false; setBusy(false); }
  }
  return <Context.Provider value={{ settings, busy, error, save }}>{children}</Context.Provider>;
}

export function CvHeading({ id, fallback }) {
  const context = useContext(Context);
  const title = context?.settings.titles[id] || fallback;
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(title);
  if (!context) return title;
  async function submit() {
    if (!draft.trim()) return;
    if (await context.save({ ...context.settings, titles: { ...context.settings.titles, [id]: draft.trim() } })) setEditing(false);
  }
  return editing ? <span className="inline-flex max-w-full flex-wrap items-center gap-1">
    <input aria-label="Section heading" value={draft} maxLength={100} disabled={context.busy} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } if (e.key === "Escape") setEditing(false); }} className="w-40 rounded border px-2 py-1 text-sm font-normal" autoFocus />
    <button type="button" disabled={context.busy} aria-label="Save section heading" onClick={submit} className="rounded p-1 text-brand"><Check size={15} /></button><button type="button" aria-label="Cancel heading edit" disabled={context.busy} onClick={() => setEditing(false)} className="rounded p-1 text-muted-foreground"><X size={15} /></button>
    {context.error ? <span role="alert" className="basis-full text-xs font-normal text-red-700">{context.error}</span> : null}
  </span> : <button type="button" onClick={() => { setDraft(title); setEditing(true); }} className="group inline-flex items-center gap-2 text-left" title="Rename section">{title}<Pencil size={12} className="text-muted-foreground opacity-40 group-hover:opacity-100" /></button>;
}

function SectionEditor({ initial, busy, onSave, onCancel }) {
  const [draft, setDraft] = useState(initial);
  const change = (id, patch) => setDraft(s => ({ ...s, items: s.items.map(i => i.id === id ? { ...i, ...patch } : i) }));
  return <form onSubmit={e => { e.preventDefault(); onSave(draft); }} className="space-y-4 rounded-xl border border-brand/25 bg-brand/[0.02] p-4">
    <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs font-medium">Section name<input required maxLength={100} className={input} value={draft.title} disabled={busy} onChange={e => setDraft(s => ({ ...s, title: e.target.value }))} /></label><div className="space-y-1"><label htmlFor={`${draft.id}-type`} className="text-xs font-medium">Layout</label><select id={`${draft.id}-type`} className={input} value={draft.type} disabled={busy} onChange={e => setDraft(s => ({ ...s, type: e.target.value }))}><option value="entries">Entries · dates and bullets</option><option value="text">Text · paragraphs</option><option value="list">List · short items</option></select></div></div>
    <div className="space-y-3">{draft.items.map((item, index) => <fieldset key={item.id} disabled={busy} className="space-y-3 rounded-lg border bg-background p-3"><legend className="px-1 text-xs text-muted-foreground">Entry {index + 1}</legend>
      {draft.type === "entries" ? <><div className="grid gap-3 sm:grid-cols-2">{[["title", "Entry title"], ["subtitle", "Organization or detail"], ["date", "Date or range"], ["location", "Location"], ["url", "Link (optional)"]].map(([key, label]) => <label key={key} className="space-y-1 text-xs font-medium">{label}<input type={key === "url" ? "url" : "text"} className={input} maxLength={key === "url" ? 2000 : 200} value={item[key]} onChange={e => change(item.id, { [key]: e.target.value })} /></label>)}</div><div className="space-y-1"><label htmlFor={`${item.id}-bullets`} className="text-xs font-medium">Contributions · one bullet per line</label><textarea id={`${item.id}-bullets`} rows={4} maxLength={20000} className={input} value={Array.isArray(item.description) ? item.description.join("\n") : item.description} onChange={e => change(item.id, { description: e.target.value.split("\n") })} /></div></> : <div className="space-y-1"><label htmlFor={`${item.id}-text`} className="text-xs font-medium">{draft.type === "text" ? "Paragraph" : "List item"}</label><textarea id={`${item.id}-text`} rows={draft.type === "text" ? 4 : 2} className={input} maxLength={10000} value={item.text} onChange={e => change(item.id, { text: e.target.value })} /></div>}
      <button type="button" onClick={() => setDraft(s => ({ ...s, items: s.items.filter(i => i.id !== item.id) }))} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"><Trash2 size={12} /> Remove entry</button>
    </fieldset>)}</div>
    <button type="button" disabled={busy || draft.items.length >= 100} onClick={() => setDraft(s => ({ ...s, items: [...s.items, blank()] }))} className="inline-flex items-center gap-1 text-xs font-medium text-brand"><Plus size={14} /> Add entry</button>
    <div className="flex items-center gap-3 border-t pt-3"><button disabled={busy || !draft.title.trim()} className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Saving…" : "Save section"}</button><button type="button" disabled={busy} onClick={onCancel} className="text-sm text-muted-foreground">Cancel</button></div>
  </form>;
}

export default function CustomCvSections() {
  const { settings, busy, error, save } = useContext(Context);
  const [editing, setEditing] = useState(null), [removing, setRemoving] = useState(null), [removed, setRemoved] = useState(null);
  async function commit(section) {
    const found = settings.customSections.some(s => s.id === section.id);
    const customSections = found ? settings.customSections.map(s => s.id === section.id ? section : s) : [...settings.customSections, section];
    if (await save({ ...settings, customSections })) setEditing(null);
  }
  async function remove(section) {
    if (await save({ ...settings, customSections: settings.customSections.filter(s => s.id !== section.id) })) { setRemoved(section); setRemoving(null); }
  }
  return <section id="custom-sections" className="scroll-mt-28 border-t pt-8">
    <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold tracking-tight">Additional sections</h2><p className="mt-1 text-sm text-muted-foreground">Research, volunteering, publications, languages — make room for your background.</p></div><button disabled={busy || Boolean(editing) || settings.customSections.length >= 20 || settings.setupPending} type="button" onClick={() => setEditing({ id: "custom:" + crypto.randomUUID(), title: "", type: "entries", items: [blank()] })} className="inline-flex shrink-0 items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium text-brand disabled:opacity-50"><Plus size={14} /> New section</button></div>
    <p className="mb-4 flex items-center gap-1 text-xs text-muted-foreground" role="status">{busy ? "Saving…" : editing ? "Unsaved changes" : <><Check size={12} className="text-brand" /> Saved</>}</p>
    {settings.setupPending ? <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Custom sections require migration 014. Your existing Master CV is available.</p> : null}
    {error ? <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    <div className="space-y-4">{settings.customSections.map(section => editing?.id === section.id ? <SectionEditor key={section.id} initial={editing} busy={busy} onSave={commit} onCancel={() => setEditing(null)} /> : <article key={section.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{section.title}</h3><p className="mt-1 text-xs text-muted-foreground">{section.type} · {section.items.length} entries</p></div><div className="flex gap-1"><button type="button" disabled={busy || Boolean(editing)} aria-label={`Edit ${section.title}`} onClick={() => setEditing(structuredClone(section))} className="rounded p-2 text-muted-foreground hover:bg-muted"><Pencil size={14} /></button><button type="button" disabled={busy || Boolean(editing)} aria-label={`Remove ${section.title}`} onClick={() => setRemoving(section.id)} className="rounded p-2 text-muted-foreground hover:bg-red-50 hover:text-destructive"><Trash2 size={14} /></button></div></div>
      <div className="mt-3 space-y-3">{section.items.map(item => <div key={item.id}><p className="whitespace-pre-line text-sm font-medium">{section.type === "entries" ? item.title : item.text}</p>{section.type === "entries" ? <><p className="text-xs text-muted-foreground">{[item.subtitle, item.date].filter(Boolean).join(" · ")}</p><ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">{(Array.isArray(item.description) ? item.description : item.description.split("\n")).filter(Boolean).map((b, i) => <li key={i}>{b}</li>)}</ul></> : null}</div>)}</div>
      {removing === section.id ? <div className="mt-3 rounded-lg bg-muted p-3 text-xs"><p>Remove this section from Master CV? Existing resume copies stay.</p><div className="mt-2 flex gap-4"><button disabled={busy} type="button" onClick={() => remove(section)} className="text-destructive">Remove section</button><button disabled={busy} type="button" onClick={() => setRemoving(null)}>Keep it</button></div></div> : null}
    </article>)}
      {editing && !settings.customSections.some(s => s.id === editing.id) ? <SectionEditor key={editing.id} initial={editing} busy={busy} onSave={commit} onCancel={() => setEditing(null)} /> : null}
    </div>
    {removed ? <div className="mt-4 flex items-center gap-3 text-xs"><span>{removed.title} removed.</span><button disabled={busy} type="button" className="font-medium text-brand" onClick={async () => { if (await save({ ...settings, customSections: [...settings.customSections, removed] })) setRemoved(null); }}>Undo</button></div> : null}
  </section>;
}
