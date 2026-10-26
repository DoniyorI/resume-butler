import { formatMonthYear } from "@/lib/dates";
import { EditableText } from "@/features/resumes/editor/EditableText";
import { editableFieldProps, readFieldOnBlur } from "@/features/resumes/editor/editableField";

// Without an end date the current month is shown, as an expected graduation
function expectedEndDate(endDate) {
  return endDate
    ? formatMonthYear(endDate)
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

export function EducationSection({ item, onChange }) {
  const handleBlur = (e) => {
    const { field, value } = readFieldOnBlur(e);
    onChange({ ...item, [field]: value });
  };

  const fieldProps = { ...editableFieldProps, onBlur: handleBlur };
  const placeholderClass = (empty) => (empty ? "contentEditablePlaceholder" : "");

  return (
    <div>
      <div className="flex justify-between items-end mt-3">
        <EditableText
          as="span"
          className={`input text-md font-semibold ${placeholderClass(!item.school)}`}
          {...fieldProps}
          data-placeholder="Enter School Name"
          data-field="school"
          value={item.school || ""}
        />
        <div className="font-semibold">
          Expected{" "}
          <EditableText
            as="span"
            className="input text-sm"
            {...fieldProps}
            data-placeholder="Enter End Date"
            data-field="endDate"
            value={expectedEndDate(item.endDate)}
          />
        </div>
      </div>
      <div className="text-sm flex justify-between italic">
        <div className="flex items-center">
          <EditableText
            as="span"
            className={`input ${placeholderClass(!item.degreeType)}`}
            {...fieldProps}
            data-placeholder="Degree Type"
            data-field="degreeType"
            value={item.degreeType || ""}
          />
          <span className="label"> ,</span>
          <EditableText
            as="span"
            className={`input ${placeholderClass(!item.major)}`}
            {...fieldProps}
            data-placeholder="Major"
            data-field="major"
            value={item.major || ""}
          />
          <span className="label"> ,</span>
          <EditableText
            as="span"
            className={`input ${placeholderClass(!item.gpa)}`}
            {...fieldProps}
            data-placeholder="GPA"
            data-field="gpa"
            value={item.gpa || ""}
          />
          GPA
        </div>

        <EditableText
          as="span"
          className={`input italic ${placeholderClass(!item.location)}`}
          {...fieldProps}
          data-placeholder="Location"
          data-field="location"
          value={item.location || ""}
        />
      </div>
    </div>
  );
}
