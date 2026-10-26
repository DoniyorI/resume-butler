"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LocalDateTime from "@/components/shared/LocalDateTime";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORT_OPTIONS = ["Recently Opened", "A-Z", "Z-A", "Recently Created", "Latest Updated"];
const TITLE_DISPLAY_MAX = 18;
const TITLE_TRUNCATE_AT = 15;

const SORTERS = {
  "A-Z": (a, b) => a.title.localeCompare(b.title),
  "Z-A": (a, b) => b.title.localeCompare(a.title),
  "Recently Created": (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  "Latest Updated": (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
};

function shortTitle(title) {
  return title.length > TITLE_DISPLAY_MAX ? `${title.substring(0, TITLE_TRUNCATE_AT)}...` : title;
}

// Card grid for the resume and cover letter lists. `items` come from data.js
// ({ id, title, createdAt, updatedAt }); renameAction / deleteAction are
// Server Actions returning { ok, error }.
export function DocumentGrid({
  heading,
  noun,
  filterPlaceholder,
  hrefBase,
  items: initialItems,
  newItemCard,
  renameAction,
  deleteAction,
}) {
  const [items, setItems] = useState(initialItems);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState(SORT_OPTIONS[0]);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");

  const visibleItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = items.filter((item) => item.title.toLowerCase().includes(term));
    const sorter = SORTERS[sortOrder];
    return sorter ? [...filtered].sort(sorter) : filtered;
  }, [items, searchTerm, sortOrder]);

  const startRename = (item) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  const saveTitle = async (item) => {
    setEditingId(null);
    const title = editingTitle.trim();
    if (!title || title === item.title) return;

    const result = await renameAction(item.id, title);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, title } : i)));
    toast("Title updated successfully");
  };

  const handleDelete = async (id) => {
    const result = await deleteAction(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast(`${noun} deleted successfully`);
  };

  return (
    <div className="flex flex-col w-full min-h-screen pt-24 pb-10 px-10">
      <h1 className="text-2xl font-semibold text-brand">{heading}</h1>
      <div className="flex justify-between mx-2 my-1 mt-3">
        <Input
          placeholder={filterPlaceholder}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="max-w-sm"
        />
        <Select defaultValue={SORT_OPTIONS[0]} onValueChange={setSortOrder}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={SORT_OPTIONS[0]} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <h2 className="text-lg text-brand font-semibold mt-4">{heading}</h2>
      <div className="flex flex-wrap">
        {newItemCard}
        {visibleItems.map((item) => (
          <div key={item.id} className="flex flex-col m-2 h-[220px] w-[170px] border rounded-md shadow">
            <Link
              href={`${hrefBase}/${item.id}`}
              className="h-full flex justify-center items-center cursor-pointer"
            >
              Preview
            </Link>
            <div className="flex justify-between py-2 px-2 bg-slate-100">
              <div>
                {editingId === item.id ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onBlur={() => saveTitle(item)}
                    onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
                    maxLength={200}
                    className="text-sm w-full bg-inherit focus:ring-0"
                    autoFocus
                  />
                ) : (
                  <div
                    className="flex justify-center items-center cursor-pointer"
                    onDoubleClick={() => startRename(item)}
                  >
                    {shortTitle(item.title)}
                  </div>
                )}
                <div className="text-xs text-slate-400">
                  <LocalDateTime value={item.updatedAt} format="date" />
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="p-0 m-0 outline-none select-none">
                    <EllipsisVertical size={18} />
                  </Button>
                </DropdownMenuTrigger>
                {/* onCloseAutoFocus: keep focus in the rename input, not the menu trigger */}
                <DropdownMenuContent
                  align="end"
                  className="text-sm"
                  onCloseAutoFocus={(event) => event.preventDefault()}
                >
                  <DropdownMenuItem className="text-xs cursor-pointer" onClick={() => startRename(item)}>
                    <Pencil className="mr-2 h-4 w-4" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-xs cursor-pointer text-red-500"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
