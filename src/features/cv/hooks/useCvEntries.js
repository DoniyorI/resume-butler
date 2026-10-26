"use client";

import { useState } from "react";
import { toast } from "sonner";

let nextKey = 0;

// Gives each entry a stable React key, so deleting one doesn't shift the
// internal state of the inputs below it
function withKey(entry) {
  return { ...entry, key: entry.id || `new-${nextKey++}` };
}

// Local editing state for a list of CV entries (optionally with ordered
// bullets), saved as a whole with a Server Action.
//   toState:  server entry -> form state (e.g. date strings -> Date)
//   toInput:  form state -> action input
//   newEntry: () => blank entry
export function useCvEntries(
  initialEntries,
  { toState, toInput, newEntry, saveAction, deleteAction, savedMessage }
) {
  const fromServer = (entries) => entries.map((entry) => withKey(toState(entry)));
  const [entries, setEntries] = useState(() => fromServer(initialEntries));
  const [saving, setSaving] = useState(false);

  const updateAt = (index, change) =>
    setEntries((current) => current.map((entry, i) => (i === index ? change(entry) : entry)));

  const addEntry = () => setEntries((current) => [...current, withKey(newEntry())]);

  const updateEntry = (index, field, value) =>
    updateAt(index, (entry) => ({ ...entry, [field]: value }));

  const deleteEntry = async (index) => {
    const entry = entries[index];
    if (entry.id) {
      const result = await deleteAction(entry.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
    }
    setEntries((current) => current.filter((item) => item.key !== entry.key));
  };

  const addBullet = (index) =>
    updateAt(index, (entry) => ({ ...entry, bullets: [...entry.bullets, ""] }));

  const updateBullet = (index, bulletIndex, value) =>
    updateAt(index, (entry) => ({
      ...entry,
      bullets: entry.bullets.map((bullet, i) => (i === bulletIndex ? value : bullet)),
    }));

  const deleteBullet = (index, bulletIndex) =>
    updateAt(index, (entry) => ({
      ...entry,
      bullets: entry.bullets.filter((_, i) => i !== bulletIndex),
    }));

  const save = async () => {
    setSaving(true);
    const result = await saveAction(entries.map(toInput));
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    // Replace local state so new entries pick up their ids
    setEntries(fromServer(result.data));
    toast(savedMessage);
  };

  return {
    entries,
    saving,
    addEntry,
    updateEntry,
    deleteEntry,
    addBullet,
    updateBullet,
    deleteBullet,
    save,
  };
}
