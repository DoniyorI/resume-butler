import { Plus, Trash2 } from "lucide-react";
import { Field } from "./Field";
import { itemBullets } from "@/features/resumes/resumeDocument";

export default function CustomItem({ item, type = "entries", onChange, onRemove }) {
  const bullets = itemBullets(item);
  return <div className="rb-item group/item relative" data-unprinted={type !== "entries" && !item.text || undefined}>
    <button type="button" onClick={onRemove} aria-label={`Remove ${item.title || "entry"}`} className="absolute -left-[0.35in] top-0 rounded p-1 text-muted-foreground opacity-0 hover:text-destructive focus:opacity-100 group-hover/item:opacity-100"><Trash2 size={12} /></button>
    {type === "entries" ? <>
      <div className="rb-row flex items-baseline justify-between gap-4"><Field className="font-bold" value={item.title} placeholder="Entry title" onCommit={title => onChange({ title })} /><Field className="rb-small shrink-0 font-bold" value={item.date} placeholder="Date or range" onCommit={date => onChange({ date })} /></div>
      <div className="rb-row rb-small flex justify-between gap-4 italic" data-unprinted={!item.subtitle && !item.location || undefined}><Field value={item.subtitle} placeholder="Organization or detail" onCommit={subtitle => onChange({ subtitle })} /><Field value={item.location} placeholder="Location (optional)" onCommit={location => onChange({ location })} /></div>
      <div className="rb-small" data-unprinted={!item.url || undefined}><Field value={item.url} placeholder="Link (optional)" onCommit={url => onChange({ url })} /></div>
      <ul className="rb-small rb-bullets" data-unprinted={!bullets.some(Boolean) || undefined}>{bullets.map((text, index) => <li key={index} className="relative"><span aria-hidden className="absolute -left-[0.16in] top-0 text-[6pt]">●</span><Field as="div" className="block" value={text} placeholder="Describe the contribution or result" onCommit={value => onChange({ description: bullets.map((b, i) => i === index ? value : b) })} /></li>)}</ul>
      <button type="button" onClick={() => onChange({ description: [...bullets, ""] })} className="absolute -right-[0.45in] top-6 inline-flex items-center gap-1 rounded px-1 font-sans text-[10px] text-brand opacity-0 hover:bg-brand/10 focus:opacity-100 group-hover/item:opacity-100" data-unprinted><Plus size={11} /> Add bullet</button>
    </> : <div className={type === "list" ? "rb-small rb-bullets relative" : "rb-small whitespace-pre-line leading-relaxed"}>
      {type === "list" ? <span aria-hidden className="absolute -left-[0.16in] top-0 text-[6pt]">●</span> : null}
      <Field as="div" value={item.text} placeholder={type === "list" ? "List item" : "Write a paragraph"} onCommit={text => onChange({ text })} className="block" />
    </div>}
  </div>;
}
