import { formatMonthYear } from "@/lib/dates";
import { BulletList } from "@/features/resumes/editor/BulletList";
import { EditableText } from "@/features/resumes/editor/EditableText";
import { editableFieldProps, readFieldOnBlur, toBullets } from "@/features/resumes/editor/editableField";

export function ProjectsSection({ item, onChange, bulletSeverities = {} }) {
  const handleBlur = (e) => {
    const { field, value } = readFieldOnBlur(e);
    onChange({ [field]: value });
  };

  const fieldProps = { ...editableFieldProps, onBlur: handleBlur };
  const noEndDate = !item.endDate && !item.currentlyWorking;

  return (
    <div className="Project">
      <div className="flex justify-between items-baseline">
        <EditableText
          as="span"
          className={`input text-sm font-semibold ${!item.projectName ? "contentEditablePlaceholder" : ""}`}
          {...fieldProps}
          data-placeholder="Enter Project Name"
          data-field="projectName"
          value={item.projectName || ""}
        />
        <EditableText
          as="span"
          className={`input text-sm font-semibold ${noEndDate ? "contentEditablePlaceholder" : ""}`}
          {...fieldProps}
          data-placeholder="Enter End Date"
          data-field="endDate"
          value={item.currentlyWorking ? "Present" : formatMonthYear(item.endDate)}
        />
      </div>
      <BulletList
        bullets={toBullets(item.description)}
        severities={bulletSeverities}
        onChange={(description) => onChange({ description })}
      />
    </div>
  );
}
