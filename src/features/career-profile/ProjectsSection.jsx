"use client";

import { ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { safeHttpUrl } from "@/lib/safeUrl";
import { deleteProject, saveProjects } from "@/features/cv/actions";
import EditDialog from "@/features/career-profile/EditDialog";
import { BulletsField, Field, MonthField, TextField } from "@/features/career-profile/fields";
import {
  bulletsForEditing,
  cleanBullets,
  displayUrl,
  formatRange,
  fromMonthInput,
  toMonthInput,
} from "@/features/career-profile/format";
import { Bullets, EditButton, Section } from "@/features/career-profile/Section";
import { useEntryList } from "@/features/career-profile/useEntryList";

const BLANK = {
  id: null,
  name: "",
  description: "",
  url: "",
  currentlyWorking: false,
  startDate: "",
  endDate: "",
  bullets: [],
};

const toDraft = (entry) => ({
  ...entry,
  url: entry.url || "",
  start: toMonthInput(entry.startDate),
  end: toMonthInput(entry.endDate),
  bullets: bulletsForEditing(entry.bullets),
});
const fromDraft = ({ start, end, ...entry }) => ({
  ...entry,
  startDate: fromMonthInput(start),
  endDate: entry.currentlyWorking ? null : fromMonthInput(end),
  bullets: cleanBullets(entry.bullets),
});

export default function ProjectsSection({ initialItems }) {
  const list = useEntryList(initialItems, {
    saveAll: saveProjects,
    deleteOne: deleteProject,
    noun: "Project",
  });
  const editingItem = list.editing && (list.editing.index === null ? BLANK : list.items[list.editing.index]);

  return (
    <Section
      id="projects"
      title="Projects"
      count={list.items.length}
      addLabel="Add project"
      onAdd={list.startAdd}
      empty={{
        title: "Add a project",
        body: "Side projects, hackathons and open source show what you build when no one asks you to.",
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {list.items.map((entry, index) => {
          const href = safeHttpUrl(entry.url);
          return (
            <article key={entry.id ?? index} className="group rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-medium leading-snug">{entry.name || "Untitled project"}</h3>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {formatRange(entry.startDate, entry.endDate, entry.currentlyWorking)}
                  </p>
                </div>
                <EditButton label={`Edit ${entry.name || "project"}`} onClick={() => list.startEdit(index)} />
              </div>
              {entry.description && <p className="mt-2 text-sm text-muted-foreground">{entry.description}</p>}
              <Bullets items={entry.bullets} />
              {href && (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-brand hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> {displayUrl(href)}
                </a>
              )}
            </article>
          );
        })}
      </div>

      <EditDialog
        open={Boolean(list.editing)}
        onOpenChange={(open) => !open && list.close()}
        title={list.editing?.index === null ? "Add project" : "Edit project"}
        initial={editingItem && toDraft(editingItem)}
        onSave={(draft) => list.save(fromDraft(draft))}
        onDelete={list.editing?.index !== null ? list.remove : undefined}
      >
        {(draft, update) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="proj-name"
                label="Project name"
                value={draft.name}
                onChange={(name) => update({ name })}
                required
              />
              <TextField
                id="proj-url"
                label="Link"
                value={draft.url}
                onChange={(url) => update({ url })}
                placeholder="github.com/you/project"
              />
              <MonthField
                id="proj-start"
                label="Started"
                value={draft.start}
                onChange={(start) => update({ start })}
              />
              <MonthField
                id="proj-end"
                label="Finished"
                value={draft.end}
                onChange={(end) => update({ end })}
                disabled={draft.currentlyWorking}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="proj-current"
                checked={draft.currentlyWorking}
                onCheckedChange={(checked) => update({ currentlyWorking: checked === true })}
              />
              <Label htmlFor="proj-current" className="text-sm font-normal">
                I&apos;m still working on this
              </Label>
            </div>
            <Field id="proj-description" label="One-line summary">
              <Textarea
                id="proj-description"
                rows={2}
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
                placeholder="A budgeting app that categorizes spending with ML"
              />
            </Field>
            <BulletsField
              id="proj-bullets"
              value={draft.bullets}
              onChange={(bullets) => update({ bullets })}
            />
          </>
        )}
      </EditDialog>
    </Section>
  );
}
