import { Globe, Linkedin, Mail, Phone } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Field } from "@/features/resumes/studio/paper/Field";
import ParagraphList from "@/features/cover-letters/studio/ParagraphList";

const CONTACTS = [
  { field: "contactEmail", placeholder: "Email", Icon: Mail, underline: true },
  { field: "contactPhone", placeholder: "Phone", Icon: Phone },
  { field: "linkedin", placeholder: "LinkedIn URL", Icon: Linkedin, underline: true },
  { field: "portfolio", placeholder: "Portfolio URL", Icon: Globe, underline: true },
];

// Same wording as the PDF (generateCoverLetterLatex)
function longDate(value) {
  return value
    ? new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";
}

function LetterDate({ value, onChange }) {
  const date = value ? new Date(value) : undefined;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="rb-field text-left">
          {longDate(value) || <span className="text-zinc-400">Add the date</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0 font-sans">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(next) => onChange(next ? next.toISOString() : null)}
          initialFocus
        />
        <div className="flex justify-between border-t p-2">
          <button
            type="button"
            onClick={() => onChange(new Date().toISOString())}
            className="rounded px-2 py-1 text-xs font-medium text-brand hover:bg-brand/10"
          >
            Today
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              Remove date
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The editable letter page: header like the resume's, then date, recipient,
 * greeting, paragraphs and sign-off. Empty optional lines are marked
 * data-unprinted, since the PDF leaves them out.
 */
export default function LetterPaper({ letterDoc, jobDescription }) {
  const { letter, update, updateHeader, updateRecipient, setParagraphs } = letterDoc;
  const { header, recipient } = letter;

  return (
    <>
      <header className="text-center">
        <Field
          as="h1"
          className="rb-letter-name"
          value={header.name}
          placeholder="Your name"
          onCommit={(value) => updateHeader("name", value)}
        />
        <div className="rb-letter-contacts flex flex-wrap items-center justify-center gap-x-[0.9em]">
          {CONTACTS.map(({ field, placeholder, Icon, underline }) => (
            <span key={field} className="inline-flex items-center gap-[0.3em]">
              <Icon aria-hidden className="h-[9pt] w-[9pt]" strokeWidth={2.25} />
              <Field
                className={underline ? "underline underline-offset-2" : undefined}
                value={header[field]}
                placeholder={placeholder}
                onCommit={(value) => updateHeader(field, value)}
              />
            </span>
          ))}
        </div>
      </header>
      <div className="rb-letter-rule" aria-hidden />

      <div className="rb-letter-block" data-unprinted={!letter.date || undefined}>
        <LetterDate value={letter.date} onChange={(date) => update({ date })} />
      </div>

      <div
        className="rb-letter-block"
        data-unprinted={!recipient.name && !recipient.company ? true : undefined}
      >
        {/* One row per line: an empty field shows inline, so each needs its own row */}
        <div>
          <Field
            value={recipient.name}
            placeholder="Hiring manager's name (optional)"
            onCommit={(value) => updateRecipient("name", value)}
          />
        </div>
        <div>
          <Field
            value={recipient.company}
            placeholder="Company (optional)"
            onCommit={(value) => updateRecipient("company", value)}
          />
        </div>
      </div>

      <div className="rb-letter-block">
        <Field
          value={letter.greeting}
          placeholder="Dear Hiring Manager,"
          onCommit={(greeting) => update({ greeting: greeting || "Dear Hiring Manager," })}
        />
      </div>

      <ParagraphList
        paragraphs={letter.paragraphs}
        onChange={setParagraphs}
        jobDescription={jobDescription}
      />

      <div className="rb-letter-block">
        <div>
          <Field
            value={letter.signOff}
            placeholder="Sincerely,"
            onCommit={(signOff) => update({ signOff: signOff || "Sincerely," })}
          />
        </div>
        <div>{header.name}</div>
      </div>
    </>
  );
}
