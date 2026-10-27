import { Fragment } from "react";
import { InputSizer } from "@/features/resumes/editor/InputSizer";

const CONTACT_FIELDS = [
  { field: "email", placeholder: "Email" },
  { field: "phone", placeholder: "Phone Number" },
  { field: "linkedin", placeholder: "LinkedIn Profile" },
  { field: "github", placeholder: "GitHub Profile" },
];

// Name and contact line at the top of the resume page. Saved with the rest of
// the resume content by useResumeDocument's autosave.
export function ResumeHeader({ header, onChange }) {
  return (
    <>
      <div className="text-center">
        <input
          type="text"
          className="bg-transparent text-center w-full focus:outline-none text-3xl uppercase font-bold"
          placeholder="Your Name"
          value={header.name || ""}
          onChange={(e) => onChange("name", e.target.value)}
        />
      </div>
      <div className="flex -mt-2 mb-2 text-sm justify-center items-center font-light">
        <div className="flex justify-center items-center">
          {CONTACT_FIELDS.map(({ field, placeholder }, index) => (
            <Fragment key={field}>
              {index > 0 && <span>|</span>}
              <InputSizer
                placeholder={placeholder}
                value={header[field] || ""}
                onChange={(value) => onChange(field, value)}
              />
            </Fragment>
          ))}
        </div>
      </div>
    </>
  );
}
