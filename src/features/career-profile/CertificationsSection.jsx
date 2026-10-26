"use client";

import { ExternalLink } from "lucide-react";
import { safeHttpUrl } from "@/lib/safeUrl";
import { deleteCertification, saveCertifications } from "@/features/cv/actions";
import EditDialog from "@/features/career-profile/EditDialog";
import { MonthField, TextField } from "@/features/career-profile/fields";
import { formatRange, fromMonthInput, toMonthInput } from "@/features/career-profile/format";
import { EditButton, Section } from "@/features/career-profile/Section";
import { useEntryList } from "@/features/career-profile/useEntryList";

const BLANK = { id: null, name: "", issuer: "", dateEarned: "", url: "" };

const toDraft = (entry) => ({ ...entry, url: entry.url || "", earned: toMonthInput(entry.dateEarned) });
const fromDraft = ({ earned, ...entry }) => ({ ...entry, dateEarned: fromMonthInput(earned) });

export default function CertificationsSection({ initialItems }) {
  const list = useEntryList(initialItems, {
    saveAll: saveCertifications,
    deleteOne: deleteCertification,
    noun: "Certification",
  });
  const editingItem = list.editing && (list.editing.index === null ? BLANK : list.items[list.editing.index]);

  return (
    <Section
      id="certifications"
      title="Certifications"
      count={list.items.length}
      addLabel="Add certification"
      onAdd={list.startAdd}
      empty={{
        title: "Add a certification",
        body: "AWS, Google Cloud, Scrum and the like. Optional, but they help with keyword matching.",
      }}
    >
      <ul className="divide-y">
        {list.items.map((entry, index) => {
          const href = safeHttpUrl(entry.url);
          return (
            <li
              key={entry.id ?? index}
              className="group flex items-start justify-between gap-3 py-3 first:pt-0"
            >
              <div className="min-w-0">
                <h3 className="font-medium leading-snug">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {entry.name || "Untitled certification"}{" "}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </a>
                  ) : (
                    entry.name || "Untitled certification"
                  )}
                </h3>
                {entry.issuer && <p className="text-sm text-muted-foreground">{entry.issuer}</p>}
              </div>
              <div className="flex shrink-0 items-start gap-1">
                <span className="pt-0.5 text-sm tabular-nums text-muted-foreground">
                  {formatRange(entry.dateEarned)}
                </span>
                <EditButton
                  label={`Edit ${entry.name || "certification"}`}
                  onClick={() => list.startEdit(index)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <EditDialog
        open={Boolean(list.editing)}
        onOpenChange={(open) => !open && list.close()}
        title={list.editing?.index === null ? "Add certification" : "Edit certification"}
        initial={editingItem && toDraft(editingItem)}
        onSave={(draft) => list.save(fromDraft(draft))}
        onDelete={list.editing?.index !== null ? list.remove : undefined}
      >
        {(draft, update) => (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              id="cert-name"
              label="Certification"
              value={draft.name}
              onChange={(name) => update({ name })}
              required
              className="sm:col-span-2"
            />
            <TextField
              id="cert-issuer"
              label="Issued by"
              value={draft.issuer}
              onChange={(issuer) => update({ issuer })}
              placeholder="Amazon Web Services"
            />
            <MonthField
              id="cert-earned"
              label="Earned"
              value={draft.earned}
              onChange={(earned) => update({ earned })}
            />
            <TextField
              id="cert-url"
              label="Credential link"
              value={draft.url}
              onChange={(url) => update({ url })}
              placeholder="Optional"
              className="sm:col-span-2"
            />
          </div>
        )}
      </EditDialog>
    </Section>
  );
}
