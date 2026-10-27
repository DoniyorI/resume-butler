"use client";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { GripVertical, Trash2 } from "lucide-react";
import { EducationSection } from "@/features/resumes/editor/sections/EducationSection";
import { ExperienceSection } from "@/features/resumes/editor/sections/ExperienceSection";
import { ProjectsSection } from "@/features/resumes/editor/sections/ProjectsSection";
import { SkillsSection } from "@/features/resumes/editor/sections/SkillsSection";

const SECTION_COMPONENTS = {
  education: EducationSection,
  experience: ExperienceSection,
  projects: ProjectsSection,
  skills: SkillsSection,
};

// ATS feedback for one item, keyed by bullet index
function bulletSeverities(bulletFeedback, sectionId, itemIndex) {
  return bulletFeedback
    .filter((fb) => fb.section === sectionId && fb.itemIndex === itemIndex)
    .reduce((acc, fb) => {
      acc[fb.bulletIndex] = fb;
      return acc;
    }, {});
}

// The resume's sections, reorderable by drag and drop. Loaded with
// next/dynamic so the drag-and-drop library stays out of the initial bundle.
export default function SectionBoard({
  sections,
  bulletFeedback,
  onMoveSection,
  onAddItem,
  onChangeItem,
  onDeleteItem,
}) {
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    onMoveSection(result.source.index, result.destination.index);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="sections" type="sections">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {sections.map((section, index) => {
              const ItemComponent = SECTION_COMPONENTS[section.id];
              return (
                <Draggable key={section.id} draggableId={section.id} index={index}>
                  {(dragProvided) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      className="mb-2 mt-[-6pt]"
                    >
                      <h2 className="flex justify-between items-center text-left text-lg font-bold small-caps border-black pl-1 border-b-2">
                        <div className="flex items-center gap-1">
                          <GripVertical size={14} className="text-gray-300 cursor-grab" />
                          {section.title}
                        </div>
                        <button
                          className="text-[#188665] font-light text-sm hover:bg-green-100 px-2 py-1"
                          onClick={() => onAddItem(section.id)}
                        >
                          + Add {section.title}
                        </button>
                      </h2>
                      {section.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="text-left text-sm pl-2 relative">
                          <ItemComponent
                            item={item}
                            onChange={(changes) => onChangeItem(section.id, itemIndex, changes)}
                            bulletSeverities={bulletSeverities(bulletFeedback, section.id, itemIndex)}
                          />
                          <Trash2
                            size={16}
                            strokeWidth={1}
                            className="absolute -left-5 top-1/3 cursor-pointer hover:text-red-500"
                            onClick={() => onDeleteItem(section.id, itemIndex)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
