import { EditableText } from "@/features/resumes/editor/EditableText";
import { editableFieldProps } from "@/features/resumes/editor/editableField";

export function SkillsSection({ item, onChange }) {
  const handleBlur = (e) => {
    const field = e.target.getAttribute("data-field");
    onChange({ ...item, [field]: e.target.textContent.trim() });
  };

  return (
    <div className="my-1">
      <div className="text-md flex items-center">
        <EditableText
          as="span"
          className={`input text-md font-semibold ${!item.header ? "contentEditablePlaceholder" : ""}`}
          {...editableFieldProps}
          onBlur={handleBlur}
          data-placeholder="Header"
          data-field="header"
          value={item.header || ""}
        />
        :{" "}
        <EditableText
          as="span"
          className={`input text-md font-normal ${!item.skills ? "contentEditablePlaceholder" : ""}`}
          {...editableFieldProps}
          onBlur={handleBlur}
          data-placeholder="Skill1, Skill2, Skill3..."
          data-field="skills"
          value={item.skills || ""}
        />
      </div>
    </div>
  );
}
