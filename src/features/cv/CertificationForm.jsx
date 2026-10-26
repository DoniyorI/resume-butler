"use client";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MonthYearPicker } from "@/components/shared/MonthYearPicker";
import { deleteCertification, saveCertifications } from "@/features/cv/actions";
import { useCvEntries } from "@/features/cv/hooks/useCvEntries";
import { toDateString, toPickerDate } from "@/features/cv/pickerDates";

const toState = (entry) => ({ ...entry, dateEarned: toPickerDate(entry.dateEarned) });

const toInput = (entry) => ({
  id: entry.id,
  name: entry.name,
  issuer: entry.issuer,
  dateEarned: toDateString(entry.dateEarned),
  url: entry.url,
});

const newEntry = () => ({ name: "", issuer: "", dateEarned: "", url: "" });

export default function CertificationForm({ initialEntries }) {
  const {
    entries: certifications,
    saving,
    addEntry,
    updateEntry,
    deleteEntry,
    save,
  } = useCvEntries(initialEntries, {
    toState,
    toInput,
    newEntry,
    saveAction: saveCertifications,
    deleteAction: deleteCertification,
    savedMessage: "Certifications saved successfully!",
  });

  return (
    <>
      <div className="flex space-x-6 justify-between items-center py-4">
        <h1 className="text-2xl text-[#5CA78F] cursor-default">Certifications</h1>
        <Button className="text-[#188665] font-light hover:bg-green-100" variant="ghost" onClick={addEntry}>
          <Plus size={16} className="mr-1" /> Add Certification
        </Button>
      </div>

      {certifications.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-8">
          No certifications added yet. Click &quot;Add Certification&quot; to get started.
        </p>
      )}

      {certifications.map((cert, index) => (
        <div className="flex gap-4 pb-8" key={cert.key}>
          <div className="flex items-start pt-8">
            <Trash2
              strokeWidth={1.25}
              size={18}
              className="cursor-pointer hover:text-red-500 text-gray-400"
              onClick={() => deleteEntry(index)}
            />
          </div>
          <div className="flex flex-col space-y-4 flex-grow">
            <div className="flex space-x-6">
              <div className="flex-grow">
                <Label>Certification Name</Label>
                <Input
                  value={cert.name}
                  onChange={(e) => updateEntry(index, "name", e.target.value)}
                  placeholder="e.g. AWS Solutions Architect"
                />
              </div>
              <div className="flex-grow">
                <Label>Issuing Organization</Label>
                <Input
                  value={cert.issuer}
                  onChange={(e) => updateEntry(index, "issuer", e.target.value)}
                  placeholder="e.g. Amazon Web Services"
                />
              </div>
            </div>
            <div className="flex space-x-6">
              <div>
                <Label>Date Earned</Label>
                <MonthYearPicker
                  value={cert.dateEarned}
                  onChange={(date) => updateEntry(index, "dateEarned", date)}
                />
              </div>
              <div className="flex-grow">
                <Label>Credential URL</Label>
                <Input
                  type="url"
                  value={cert.url}
                  onChange={(e) => updateEntry(index, "url", e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      {certifications.length > 0 && (
        <div className="flex space-x-6 justify-end">
          <Button type="button" onClick={save} disabled={saving}>
            Save
          </Button>
        </div>
      )}
    </>
  );
}
