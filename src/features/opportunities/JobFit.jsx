"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown, CircleCheck, CircleDashed, CircleHelp, CircleMinus, CircleDot } from "lucide-react";

// How a saved job compares with the Master CV (src/server/fit/assessFit.js).
// Decision support only: it never predicts an interview, suggests wording or
// adds a term anywhere.

export const BANDS = {
  strong: { label: "Strong fit", tone: "bg-brand text-white", Icon: CircleCheck },
  good: { label: "Good fit", tone: "bg-brand/10 text-brand ring-1 ring-inset ring-brand/25", Icon: CircleDot },
  stretch: { label: "Stretch", tone: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200", Icon: CircleDashed },
  low: { label: "Low fit", tone: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200", Icon: CircleMinus },
  unknown: { label: "Not enough to tell", tone: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200", Icon: CircleHelp },
};

const STRENGTH = {
  demonstrated: { label: "Backed by your experience", tone: "text-brand" },
  listed: { label: "Listed, no example yet", tone: "text-amber-800" },
  missing: { label: "Not in your Master CV", tone: "text-slate-500" },
};

export const CHECK_KINDS = {
  "work-authorization": "Work authorisation",
  clearance: "Clearance",
  citizenship: "Citizenship",
  onsite: "On-site",
  relocation: "Relocation",
  travel: "Travel",
};

const PREFERRED_SHOWN = 4;
export const EMPTY_CV = /Master CV has no experience/i;
const article = (term) => (/^[aeiou]/i.test(term) ? "an" : "a");

// The readable name of a requirement or gap row, with its "(or ...)" alternatives
export function termName(req) {
  const name = req.label || req.term;
  const source = Array.isArray(req.alternativeLabels) ? req.alternativeLabels : req.alternatives;
  const alternatives = Array.isArray(source) ? source.filter(Boolean) : [];
  return alternatives.length ? `${name} (or ${alternatives.join(", or ")})` : name;
}

function RequirementRow({ req }) {
  const strength = STRENGTH[req.strength] || STRENGTH.missing;
  const evidence = req.strength === "demonstrated" ? (req.evidence || []).filter((e) => e?.quote) : [];
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="font-medium text-foreground">{termName(req)}</span>
        <span className={`text-[11px] ${strength.tone}`}>{strength.label}</span>
      </div>
      {evidence.map((item, i) => (
        <p key={i} className="mt-1 break-words text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-slate-600">{item.label}:</span> “{item.quote}”
        </p>
      ))}
    </li>
  );
}

function RequirementList({ title, list }) {
  return (
    <section>
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <ul className="divide-y">
        {list.map((req) => (
          <RequirementRow key={`${req.importance}:${req.term}`} req={req} />
        ))}
      </ul>
    </section>
  );
}

function PreferredList({ list }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!list.length) return null;
  if (list.length <= PREFERRED_SHOWN) return <RequirementList title="Preferred" list={list} />;
  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-foreground"
      >
        Preferred ({list.length})
        <ChevronDown size={13} className={open ? "rotate-180" : ""} aria-hidden="true" />
      </button>
      {open ? (
        <ul id={id} className="divide-y">
          {list.map((req) => (
            <RequirementRow key={`${req.importance}:${req.term}`} req={req} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function yearsLine(years) {
  if (!years || years.status === "not-stated" || years.required == null) return null;
  if (years.status === "unknown")
    return `Asks for ${years.required}+ years; add dates to your experience to compare.`;
  return `Asks for ${years.required}+ years; your dated experience covers about ${years.have} ${years.have === 1 ? "year" : "years"}.`;
}

export function degreeLine(degree) {
  if (!degree || degree.status === "not-stated" || !degree.required) return null;
  const asks = `Asks for ${article(degree.required)} ${degree.required}`;
  if (degree.status === "unknown") return `${asks}: add your education to compare.`;
  if (degree.status === "meets") return `${asks}: ${degree.inProgress ? "in progress" : "shown in your education"}.`;
  return `${asks}: not shown in your education.`;
}

function FitDetails({ fit, tailor }) {
  const required = fit.requirements.filter((req) => req.importance === "required");
  const preferred = fit.requirements.filter((req) => req.importance === "preferred");
  const missingRequired = required.some((req) => req.strength === "missing");
  const background = [yearsLine(fit.years), degreeLine(fit.degree)].filter(Boolean);
  const checks = (fit.checks || []).filter((check) => check?.quote);
  const resume = fit.resume;
  const labels = new Map(fit.requirements.map((req) => [req.term, req.label || req.term]));
  const notShown = (resume?.notShown || []).map((term) => labels.get(term) || term);
  return (
    <div className="mt-3 space-y-4 rounded-lg border bg-slate-50/60 p-3 text-xs">
      {required.length ? <RequirementList title="Required" list={required} /> : null}
      {missingRequired ? (
        <p className="text-muted-foreground">
          If you have this experience,{" "}
          <Link href="/profile" className="font-medium text-brand hover:underline">
            add it to your Master CV
          </Link>
          .
        </p>
      ) : null}
      <PreferredList list={preferred} />
      {background.length ? (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Experience and education</h4>
          <ul className="mt-1 space-y-1 text-muted-foreground">
            {background.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {checks.length ? (
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Only you can judge</h4>
          <ul className="mt-1 space-y-1.5">
            {checks.map((check) => (
              <li key={check.kind} className="break-words leading-relaxed">
                <span className="font-medium">{CHECK_KINDS[check.kind] || "Check"}:</span>{" "}
                <span className="text-muted-foreground">“{check.quote}”</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {resume && notShown.length ? (
        <section className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 flex-1 leading-relaxed text-muted-foreground">
            Your working resume leaves out {notShown.length} {notShown.length === 1 ? "thing" : "things"} your
            Master CV backs: {notShown.join(", ")}
          </p>
          {tailor}
        </section>
      ) : resume && resume.shown?.length ? (
        <p className="text-muted-foreground">Your working resume shows everything your Master CV backs here.</p>
      ) : null}
      <p className="border-t pt-2 text-[11px] text-muted-foreground">
        Fit compares this posting with your Master CV. It is not a prediction of an interview.
      </p>
    </div>
  );
}

/**
 * The fit chip, the engine's reason and "See why". `fit` is the engine's
 * result or null; `described` says whether the job has a usable description;
 * `tailor` is the card's Tailor resume action, shown beside resume gaps.
 */
export default function JobFit({ fit, described, tailor }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!described)
    return <p className="mb-4 text-xs text-muted-foreground">Add the job description to see how this fits.</p>;
  if (!fit || !Array.isArray(fit.requirements)) return null;
  if (fit.band === "unknown" && EMPTY_CV.test(fit.reason || ""))
    return (
      <p className="mb-4 text-xs text-muted-foreground">
        <Link href="/profile" className="font-medium text-brand hover:underline">
          Add your experience to your Master CV to see fit.
        </Link>
      </p>
    );
  const band = BANDS[fit.band] || BANDS.unknown;
  const { Icon } = band;
  return (
    <div className="mb-4">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${band.tone}`}>
        <Icon size={13} aria-hidden="true" />
        {band.label}
      </span>
      {fit.reason ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{fit.reason}</p> : null}
      {fit.requirements.length || fit.checks?.length ? (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen(!open)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
          >
            See why
            <ChevronDown size={13} className={open ? "rotate-180" : ""} aria-hidden="true" />
          </button>
          <div id={id}>{open ? <FitDetails fit={fit} tailor={tailor} /> : null}</div>
        </>
      ) : null}
    </div>
  );
}
