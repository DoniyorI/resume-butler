"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * A CV section's entries plus save/remove through the existing CV actions.
 * The save actions take the whole list in display order and return the stored
 * rows, so saving one entry sends the list with that entry replaced or appended.
 */
export function useEntryList(initialItems, { saveAll, deleteOne, noun }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  // Server data changes after a resume import refreshes the page
  useEffect(() => setItems(initialItems), [initialItems]);

  // `editing` is { index } for an existing entry, or { index: null } for a new one
  const [editing, setEditing] = useState(null);

  const save = async (draft) => {
    const next =
      editing.index === null
        ? [...items, draft]
        : items.map((item, i) => (i === editing.index ? draft : item));
    const result = await saveAll(next);
    if (result.ok) {
      setItems(result.data);
      toast.success(editing.index === null ? `${noun} added` : `${noun} saved`);
      // Re-read the page so the CV strength and section counts update
      router.refresh();
    }
    return result;
  };

  const remove = async () => {
    const item = items[editing.index];
    const result = item.id ? await deleteOne(item.id) : { ok: true };
    if (result.ok) {
      setItems(items.filter((_, i) => i !== editing.index));
      toast.success(`${noun} deleted`);
      router.refresh();
    }
    return result;
  };

  return {
    items,
    editing,
    startAdd: () => setEditing({ index: null }),
    startEdit: (index) => setEditing({ index }),
    close: () => setEditing(null),
    save,
    remove,
  };
}
