"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addSkill } from "@/features/cv/actions";
import { BANDS, CHECK_KINDS, EMPTY_CV, degreeLine, termName, yearsLine } from "@/features/opportunities/JobFit";

const ROWS_SHOWN = 6;
const FOOTER = "Fit compares this posting with your Master CV. It is not a prediction of an interview.";
const BUTTON_LABELS = { entry: "Add entry", bullet: "Add bullet", skill: "Add to Skills" };
const rowKey = (row) => `${row.kind}:${row.sectionId}:${row.term}:${row.title}`;

function AddRow({ row, busy, disabled, onAdd }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5 py-2">
      <div className="min-w-0 flex-1 basis-40">
        <p className="break-words text-sm font-medium">{row.label || row.term}</p>
        <p className="break-words text-xs text-muted-foreground">{row.title}</p>
        <p className="mt-0.5 break-words text-[11px] leading-relaxed text-muted-foreground">“{row.quote}”</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 shrink-0 px-2 text-xs"
        disabled={disabled || busy}
        aria-label={`${BUTTON_LABELS[row.kind]} for ${row.label || row.term}`}
        onClick={() => onAdd(row)}
      >
        {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" /> : null}
        {BUTTON_LABELS[row.kind]}
      </Button>
    </li>
  );
}

// "I have this": the skill goes into the Master CV first, and only then can it be added to the page
function MissingRow({ row, skills, refresh }) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const categories = [...new Set(skills.map((skill) => skill.category).filter(Boolean))];
  const [name, setName] = useState(row.label || row.term);
  const [category, setCategory] = useState(categories[0] || "Other");
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // addSkill does not reject a name the user already has, so it is checked here
  const submit = async (event) => {
    event.preventDefault();
    const skillName = name.trim();
    if (!skillName || savingRef.current) return;
    if (skills.some((skill) => skill.name.trim().toLowerCase() === skillName.toLowerCase())) {
      toast.error("That skill is already in your Master CV");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    let saved = false;
    try {
      const result = await addSkill({ name: skillName, category: custom.trim() || category, sortOrder: skills.length });
      if (result.ok) {
        saved = true;
        toast.success(`${skillName} added to your Master CV`);
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Could not save that skill. Try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
    if (saved) {
      router.refresh();
      await refresh();
    }
  };

  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p className="min-w-0 flex-1 basis-40 break-words text-xs">
          The posting asks for <span className="font-medium">{termName(row)}</span>
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-7 shrink-0 px-2 text-xs"
          aria-expanded={open}
          aria-controls={id}
          aria-label={`I have this: ${row.label || row.term}`}
          onClick={() => setOpen(!open)}
        >
          I have this
        </Button>
      </div>
      {open && (
        <form id={id} onSubmit={submit} className="mt-2 space-y-2 rounded-md border bg-muted/30 p-2.5">
          <div className="space-y-1">
            <Label htmlFor={`${id}-name`} className="text-xs">Skill name</Label>
            <Input id={`${id}-name`} value={name} maxLength={100} disabled={saving} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-0 flex-1 basis-28 space-y-1">
              <Label htmlFor={`${id}-category`} className="text-xs">Category</Label>
              <select
                id={`${id}-category`}
                value={category}
                disabled={saving}
                onChange={(e) => setCategory(e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {(categories.length ? categories : ["Other"]).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0 flex-1 basis-28 space-y-1">
              <Label htmlFor={`${id}-custom`} className="text-xs">Or a new category</Label>
              <Input id={`${id}-custom`} value={custom} maxLength={50} disabled={saving} onChange={(e) => setCustom(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Only add skills you could talk about in an interview.</p>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" /> : null}
              Add to my Master CV
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={saving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}

function Checks({ checks }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const quoted = (checks || []).filter((check) => check?.quote);
  if (!quoted.length) return null;
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
      >
        Only you can judge ({quoted.length})
        <ChevronDown size={13} className={open ? "rotate-180" : ""} aria-hidden="true" />
      </button>
      {open && (
        <ul id={id} className="mt-1.5 space-y-1.5 text-xs">
          {quoted.map((check) => (
            <li key={check.kind} className="break-words leading-relaxed">
              <span className="font-medium">{CHECK_KINDS[check.kind] || "Check"}:</span>{" "}
              <span className="text-muted-foreground">“{check.quote}”</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * How the job fits the Master CV, and what this page could show of it. Rows
 * add only text the Master CV already holds; what it lacks is asked about, and
 * a skill goes to the Master CV first. `onAdd(row)` edits the page and returns
 * true when it changed it.
 */
export default function FitCard({ fit, skills, onAdd }) {
  const { result, loading, error, refresh } = fit;
  const [busyKey, setBusyKey] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const listId = useId();

  // The wait for the refetch after an add ends when a fetch settles, with rows or with an error
  useEffect(() => {
    if (!loading) setBusyKey(null);
  }, [loading, result, error]);

  if (!result) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {error || (loading ? "Checking the fit..." : "Waiting for the job description")}
        {error && !loading && (
          <Button size="sm" variant="outline" className="ml-auto h-7 px-2 text-xs" onClick={refresh}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  const { fit: assessment, gaps } = result;
  const band = BANDS[assessment.band] || BANDS.unknown;
  const { Icon } = band;
  const footer = <p className="border-t pt-2 text-[11px] text-muted-foreground">{FOOTER}</p>;
  const header = (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-semibold">
        Fit for this job
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Updating" />}
      </p>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${band.tone}`}>
        <Icon size={13} aria-hidden="true" />
        {band.label}
      </span>
      {assessment.reason ? <p className="text-xs leading-relaxed text-muted-foreground">{assessment.reason}</p> : null}
    </div>
  );

  if (assessment.band === "unknown") {
    return (
      <section className="space-y-3 rounded-lg border p-3" aria-label="Fit for this job">
        {header}
        {EMPTY_CV.test(assessment.reason || "") && (
          <Link href="/profile" className="text-xs font-medium text-brand hover:underline">
            Add your experience to your Master CV
          </Link>
        )}
        {footer}
      </section>
    );
  }

  const add = (row) => {
    if (onAdd(row)) setBusyKey(rowKey(row));
  };
  const addable = gaps.addable || [];
  const rows = showAll ? addable : addable.slice(0, ROWS_SHOWN);
  const hidden = addable.length - ROWS_SHOWN;
  const background = [
    ["short", "unknown"].includes(assessment.years?.status) ? yearsLine(assessment.years) : null,
    ["short", "unknown"].includes(assessment.degree?.status) ? degreeLine(assessment.degree) : null,
  ].filter(Boolean);
  const allShown = gaps.backed > 0 && gaps.shown === gaps.backed;

  return (
    <section className="space-y-3 rounded-lg border p-3" aria-label="Fit for this job">
      {header}
      {error && !loading && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-red-800">
          <span className="min-w-0 flex-1 basis-40">{error}</span>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={refresh}>
            Try again
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {allShown
          ? "This page shows everything your Master CV backs for this job."
          : `This page shows ${gaps.shown} of ${gaps.backed} requirements your Master CV backs.`}
      </p>

      {addable.length > 0 && (
        <div>
          <h3 className="text-xs font-medium">Add from your Master CV</h3>
          <ul id={listId} className="divide-y">
            {rows.map((row) => (
              <AddRow key={rowKey(row)} row={row} busy={busyKey === rowKey(row)} disabled={loading || busyKey !== null} onAdd={add} />
            ))}
          </ul>
          {hidden > 0 && (
            <button
              type="button"
              aria-expanded={showAll}
              aria-controls={listId}
              onClick={() => setShowAll(!showAll)}
              className="text-xs font-medium text-brand hover:underline"
            >
              {showAll ? "Show fewer" : `Show ${hidden} more`}
            </button>
          )}
        </div>
      )}

      {gaps.missing?.length > 0 && (
        <div>
          <h3 className="text-xs font-medium">Not in your Master CV</h3>
          <ul className="divide-y">
            {gaps.missing.map((row) => (
              <MissingRow key={row.term} row={row} skills={skills} refresh={refresh} />
            ))}
          </ul>
        </div>
      )}

      {background.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {background.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <Checks checks={assessment.checks} />
      {footer}
    </section>
  );
}
