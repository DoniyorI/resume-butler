"use client";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { BookUser, Eye, EyeOff, GripVertical } from "lucide-react";
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
}) {
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

      <Button variant="outline" size="sm" className="w-full" onClick={onOpenCv}>
        <BookUser className="mr-2 h-4 w-4" /> Add from Master CV
      </Button>
    </div>
  );
}
