import { formatMonthYear } from "@/lib/dates";
import { BulletList } from "@/features/resumes/editor/BulletList";
import { EditableText } from "@/features/resumes/editor/EditableText";
import { editableFieldProps, readFieldOnBlur, toBullets } from "@/features/resumes/editor/editableField";

export function ExperienceSection({ item, onChange, bulletSeverities = {} }) {
  const handleBlur = (e) => {
    const { field, value } = readFieldOnBlur(e);
    onChange({ [field]: value });
  };

  const fieldProps = { ...editableFieldProps, onBlur: handleBlur };
  const placeholderClass = (empty) => (empty ? "contentEditablePlaceholder" : "");

  return (
    <div className="Experience">
      <div className="flex justify-between items-baseline">
        <EditableText
          as="span"
          className={`input text-sm font-semibold ${placeholderClass(!item.companyName)}`}
          {...fieldProps}
          data-placeholder="Enter Company Name"
          data-field="companyName"
          value={item.companyName || ""}
        />
        <div className="flex">
          <EditableText
            as="span"
            className={`input text-sm font-semibold ${placeholderClass(!item.startDate)}`}
            {...fieldProps}
            data-placeholder="Enter Start Date"
            data-field="startDate"
            value={formatMonthYear(item.startDate)}
          />
          {" -- "}
          <EditableText
            as="span"
            className={`input text-sm font-semibold ${placeholderClass(!item.endDate && !item.currentlyWorking)}`}
            {...fieldProps}
            data-placeholder="Enter End Date"
            data-field="endDate"
            value={item.currentlyWorking ? "Present" : formatMonthYear(item.endDate)}
          />
        </div>
      </div>
      <div className="text-sm flex justify-between">
        <EditableText
          as="span"
          className={`input italic text-sm ${placeholderClass(!item.position)}`}
          {...fieldProps}
          data-placeholder="Enter Position"
          data-field="position"
          value={item.position || ""}
        />
        <EditableText
          as="span"
          className={`input italic text-sm ${placeholderClass(!item.location)}`}
          {...fieldProps}
          data-placeholder="Enter Location"
          data-field="location"
          value={item.location || ""}
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
