"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Mail, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import LocalDateTime from "@/components/shared/LocalDateTime";
import { cn } from "@/lib/utils";
import PaperPreview from "@/features/documents/PaperPreview";
import { DeleteDialog, NewDocumentDialog, RenameDialog } from "@/features/documents/DocumentDialogs";
import { DELETE, RENAME, TYPE_BADGE_CLASS, TYPE_LABELS } from "@/features/documents/documentTypes";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "resume", label: "Resumes" },
  { value: "coverLetter", label: "Cover letters" },
];

const SORTS = {
  edited: { label: "Last edited", compare: (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt) },
  created: { label: "Newest", compare: (a, b) => new Date(b.createdAt) - new Date(a.createdAt) },
  name: { label: "Name A–Z", compare: (a, b) => a.title.localeCompare(b.title) },
};

function DocumentCard({ document, onRename, onDelete }) {
  return (
    <li className="group relative">
      <Link
        href={document.href}
        className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <PaperPreview
          document={document}
          className="transition-[transform,box-shadow] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
        />
        <div className="mt-3">
          <h3 className="truncate text-sm font-medium" title={document.title}>
            {document.title}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", TYPE_BADGE_CLASS[document.type])}
            >
              {TYPE_LABELS[document.type]}
            </span>
            <span>
              Edited <LocalDateTime value={document.updatedAt} format="date" />
            </span>
          </div>
          {document.applications.length > 0 && (
            <p className="mt-1.5 truncate text-xs text-muted-foreground">
              Used for {document.applications[0].company}
              {document.applications[0].role ? ` (${document.applications[0].role})` : ""}
              {document.applications.length > 1 ? ` and ${document.applications.length - 1} more` : ""}
            </p>
          )}
        </div>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${document.title}`}
            className="absolute right-2 top-2 h-8 w-8 border bg-background/95 text-muted-foreground opacity-100 shadow-sm transition-opacity hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100 md:opacity-0 md:group-hover:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={document.href}>Open</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onRename(document)}>
            <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => onDelete(document)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function EmptyState({ filter, query, onNew }) {
  if (query) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Nothing matches “{query}”.</p>;
  }
  const showResume = filter !== "coverLetter";
  const showLetter = filter !== "resume";
  return (
    <div className="rounded-xl border border-dashed px-6 py-14 text-center">
      <p className="text-sm font-medium">
        {filter === "coverLetter"
          ? "No cover letters yet"
          : filter === "resume"
            ? "No resumes yet"
            : "No documents yet"}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Each one is tailored to a job from your master CV. Start one for the next role you&apos;re applying
        to.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        {showResume && (
          <Button onClick={() => onNew("resume")} className="bg-brand hover:bg-brand/90">
            <FileText className="mr-1.5 h-4 w-4" /> New resume
          </Button>
        )}
        {showLetter && (
          <Button variant="outline" onClick={() => onNew("coverLetter")}>
            <Mail className="mr-1.5 h-4 w-4" /> New cover letter
          </Button>
        )}
      </div>
    </div>
  );
}

// All resumes and cover letters in one library: filter by type, search, sort
export default function DocumentLibrary({ documents }) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("edited");
  const [creating, setCreating] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const counts = useMemo(
    () => ({
      all: documents.length,
      resume: documents.filter((d) => d.type === "resume").length,
      coverLetter: documents.filter((d) => d.type === "coverLetter").length,
    }),
    [documents]
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents
      .filter((d) => filter === "all" || d.type === filter)
      .filter(
        (d) =>
          !needle ||
          d.title.toLowerCase().includes(needle) ||
          d.applications.some((a) => `${a.company} ${a.role}`.toLowerCase().includes(needle))
      )
      .sort(SORTS[sort].compare);
  }, [documents, filter, query, sort]);

  const rename = async (name) => {
    const result = await RENAME[renaming.type](renaming.id, name);
    if (result.ok) {
      toast.success("Renamed");
      setRenaming(null);
      router.refresh();
    }
    return result;
  };

  const remove = async () => {
    const target = deleting;
    const result = await DELETE[target.type](target.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Deleted “${target.title}”`);
    setDeleting(null);
    router.refresh();
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumes and cover letters, tailored to each job.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreating("resume")} className="bg-brand hover:bg-brand/90">
            <Plus className="mr-1.5 h-4 w-4" /> New resume
          </Button>
          <Button variant="outline" onClick={() => setCreating("coverLetter")}>
            <Plus className="mr-1.5 h-4 w-4" /> New cover letter
          </Button>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
                <span className="ml-1.5 tabular-nums text-muted-foreground">{counts[f.value]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <div className="relative flex-1 lg:w-64 lg:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search documents"
              placeholder="Search by name or company"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-8"
            />
          </div>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger aria-label="Sort" className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORTS).map(([value, { label }]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-8">
        {visible.length === 0 ? (
          <EmptyState filter={filter} query={query.trim()} onNew={setCreating} />
        ) : (
          <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((document) => (
              <DocumentCard
                key={`${document.type}-${document.id}`}
                document={document}
                onRename={setRenaming}
                onDelete={setDeleting}
              />
            ))}
          </ul>
        )}
      </div>

      <NewDocumentDialog type={creating} onOpenChange={(open) => !open && setCreating(null)} />
      <RenameDialog
        document={renaming}
        onOpenChange={(open) => !open && setRenaming(null)}
        onRename={rename}
      />
      <DeleteDialog
        document={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDelete={remove}
      />
    </div>
  );
}
