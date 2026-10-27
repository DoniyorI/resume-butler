import { X } from "lucide-react";
import { EditableText } from "@/features/resumes/editor/EditableText";
import { editableFieldProps } from "@/features/resumes/editor/editableField";

const SEVERITY_CLASS = {
  error: "text-red-500",
  warning: "text-orange-400",
};

function DeleteButton({ onClick }) {
  return (
    <button onClick={onClick} className="ml-1 cursor-pointer text-red-800 hover:text-red-500">
      <X size={16} />
    </button>
  );
}

// Editable bullet points for an experience or project. Clicking a bullet adds
// a point below it. `severities` maps a bullet index to ATS feedback.
export function BulletList({ bullets, severities = {}, onChange }) {
  const setBullet = (index, value) => {
    const next = [...bullets];
    next[index] = value;
    onChange(next);
  };

  const addBelow = (index) => {
    const next = [...bullets];
    next.splice(index + 1, 0, "");
    onChange(next);
  };

  const remove = (index) => {
    const next = [...bullets];
    next.splice(index, 1);
    onChange(next);
  };

  return (
    <div className="pl-[22px] mt-1">
      <ul className="list-inside">
        {bullets.length > 0 ? (
          bullets.map((point, index) => {
            const feedback = severities[index];
            const bulletColor = SEVERITY_CLASS[feedback?.severity] || "";
            return (
              <li
                key={index}
                className="text-md flex items-center"
                title={feedback?.issues?.map((issue) => issue.message).join("\n") || ""}
              >
                <span className={`bullet-toggle mr-2 ${bulletColor}`} onClick={() => addBelow(index)} />
                <EditableText
                  as="div"
                  className={`input w-full text-sm ${bulletColor} ${!point ? "contentEditablePlaceholder" : ""}`}
                  {...editableFieldProps}
                  onBlur={(e) => setBullet(index, e.target.textContent)}
                  data-placeholder="Enter Description Detail"
                  value={point || ""}
                />
                <DeleteButton onClick={() => remove(index)} />
              </li>
            );
          })
        ) : (
          <li className="text-sm flex items-center">
            <span className="bullet-toggle mr-2" onClick={() => addBelow(0)} />
            <div
              contentEditable
              className="input grow text-md contentEditablePlaceholder"
              {...editableFieldProps}
              onBlur={(e) => setBullet(0, e.target.textContent)}
              data-placeholder="Enter Description Detail"
            />
            <DeleteButton onClick={() => remove(0)} />
          </li>
        )}
      </ul>
    </div>
  );
}
