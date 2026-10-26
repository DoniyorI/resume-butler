import { cn } from "@/lib/utils";

// A letter-size thumbnail drawn from the document's real text, so documents are
// recognizable at a glance. Decorative: the card's title is the accessible name.
export default function PaperPreview({ document, className }) {
  const { type, preview } = document;
  const empty =
    type === "resume" ? preview.sections.length === 0 && !preview.name : preview.lines.length === 0;

  return (
    <div
      aria-hidden
      className={cn(
        "aspect-[8.5/11] overflow-hidden rounded-md border bg-white px-[9%] py-[10%] shadow-[0_1px_2px_rgba(15,23,42,0.06)]",
        className
      )}
    >
      {empty ? (
        <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground/70">
          Blank {type === "resume" ? "resume" : "letter"}
        </div>
      ) : type === "resume" ? (
        <div className="space-y-[6%] text-[5.5px] leading-[1.45] text-slate-500">
          {preview.name && (
            <p className="truncate text-center text-[9px] font-semibold uppercase tracking-wide text-slate-800">
              {preview.name}
            </p>
          )}
          {preview.sections.map((section) => (
            <div key={section.title}>
              <p className="border-b border-slate-300 pb-[1px] text-[6.5px] font-semibold text-slate-700">
                {section.title}
              </p>
              {section.lines.map((line, i) => (
                <p key={i} className="mt-[2px] truncate">
                  {line}
                </p>
              ))}
              <div className="mt-[3px] space-y-[2px]">
                <div className="h-[2px] w-[92%] rounded bg-slate-200" />
                <div className="h-[2px] w-[78%] rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-[5%] text-[5.5px] leading-[1.5] text-slate-500">
          {preview.name && <p className="text-[7px] font-semibold text-slate-800">{preview.name}</p>}
          {preview.lines.map((line, i) => (
            <p key={i} className="line-clamp-3">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
