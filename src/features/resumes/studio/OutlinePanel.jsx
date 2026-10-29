"use client";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { useId, useState } from "react";
import { BookUser, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import FitGauge from "@/features/resumes/studio/FitGauge";

// Left rail: the one-page gauge and the sections, which can be dragged into a
// new order or hidden from the page without deleting them. Loaded with
// next/dynamic so the drag-and-drop library stays out of the first bundle.
export default function OutlinePanel({
  resumeDoc,
  fit,
  pdfCheck,
  onCheckPdf,
  onTighten,
  tightening,
  canTighten,
  onOpenCv,
  onRemoveSection,
}) {
  const layoutId = useId();
  const [adding, setAdding] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionType, setSectionType] = useState("entries");
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    resumeDoc.moveSection(result.source.index, result.destination.index);
  };

  return (
    <div className="space-y-6 p-4">
      <section aria-labelledby="fit-heading">
        <h2 id="fit-heading" className="sr-only">
          Page fit
        </h2>
        <FitGauge
          fit={fit}
          pdfCheck={pdfCheck}
          onCheckPdf={onCheckPdf}
          onTighten={onTighten}
          tightening={tightening}
          canTighten={canTighten}
        />
      </section>

      <section aria-labelledby="outline-heading">
        <h2 id="outline-heading" className="mb-2 text-sm font-medium">
          Sections
        </h2>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="outline">
            {(provided) => (
              <ul ref={provided.innerRef} {...provided.droppableProps} className="space-y-1">
                {resumeDoc.sections.map((section, index) => (
                  <Draggable key={section.id} draggableId={section.id} index={index}>
                    {(drag, snapshot) => (
                      <li
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        className={cn(
                          "flex items-center gap-1 rounded-md border bg-background py-1 pl-1 pr-1 text-sm",
                          snapshot.isDragging && "shadow-md ring-1 ring-brand/30"
                        )}
                      >
                        <span
                          {...drag.dragHandleProps}
                          aria-label={`Drag to move ${section.title}`}
                          className="flex h-7 w-6 cursor-grab items-center justify-center rounded text-muted-foreground hover:text-foreground"
                        >
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate",
                            section.hidden && "text-muted-foreground line-through"
                          )}
                        >
                          {section.title}
                        </span>
                        {section.id.startsWith("custom:") ? <button type="button" onClick={() => onRemoveSection(section.id)} aria-label={`Remove ${section.title}`} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button> : null}
                        <span className="tabular-nums text-xs text-muted-foreground">
                          {section.items.length}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => resumeDoc.updateSectionMeta(section.id, { hidden: !section.hidden })}
                          aria-label={section.hidden ? `Show ${section.title}` : `Hide ${section.title}`}
                          title={
                            section.hidden ? "Show on the page" : "Hide from the page (nothing is deleted)"
                          }
                        >
                          {section.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          Drag to reorder. Click a section title on the page to rename it.
        </p>
      </section>

      {adding ? <form className="space-y-3 rounded-lg border bg-muted/20 p-3" onSubmit={event => { event.preventDefault(); resumeDoc.addCustomSection({ title: sectionTitle.trim(), type: sectionType }); setAdding(false); setSectionTitle(""); }}>
        <label className="block text-xs font-medium">Section name<input value={sectionTitle} onChange={e => setSectionTitle(e.target.value)} required maxLength={100} placeholder="Research, volunteering…" className="mt-1 w-full rounded-md border bg-background p-2 font-normal" /></label>
        <label className="block text-xs font-medium" htmlFor={layoutId}>Layout</label><select id={layoutId} value={sectionType} onChange={e => setSectionType(e.target.value)} className="w-full rounded-md border bg-background p-2 text-xs"><option value="entries">Entries · title, dates and bullets</option><option value="text">Text · summary or statement</option><option value="list">List · languages, awards and more</option></select>
        <div className="flex gap-2"><Button size="sm" disabled={!sectionTitle.trim()}>Add section</Button><Button size="sm" type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button></div>
      </form> : <Button variant="outline" size="sm" className="w-full" disabled={resumeDoc.sections.length >= 25} onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" /> New section</Button>}
      <Button variant="outline" size="sm" className="w-full" onClick={onOpenCv}>
        <BookUser className="mr-2 h-4 w-4" /> Add from Master CV
      </Button>
    </div>
  );
}
