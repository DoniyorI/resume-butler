"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addSkill, deleteSkill } from "@/features/cv/actions";

const CATEGORIES = ["Languages", "Frameworks", "Tools", "Platforms", "Databases", "Other"];

function SkillChip({ skill, onRemove }) {
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-background py-1 pl-2.5 pr-1 text-sm">
      {skill.name}
      <button
        type="button"
        onClick={() => startTransition(() => onRemove(skill))}
        disabled={pending}
        aria-label={`Remove ${skill.name}`}
        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
      </button>
    </span>
  );
}

// Skills are short, so they're added inline rather than in a dialog
export default function SkillsSection({ initialItems }) {
  const router = useRouter();
  const [skills, setSkills] = useState(initialItems);
  useEffect(() => setSkills(initialItems), [initialItems]);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Languages");
  const [adding, startAdding] = useTransition();

  const groups = useMemo(() => {
    const byCategory = new Map();
    for (const skill of skills) {
      const key = CATEGORIES.includes(skill.category) ? skill.category : "Other";
      byCategory.set(key, [...(byCategory.get(key) || []), skill]);
    }
    return CATEGORIES.filter((c) => byCategory.has(c)).map((c) => [c, byCategory.get(c)]);
  }, [skills]);

  const add = (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (skills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`${trimmed} is already in your skills`);
      return;
    }
    startAdding(async () => {
      const result = await addSkill({ name: trimmed, category, sortOrder: skills.length });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSkills((current) => [...current, result.data]);
      setName("");
      router.refresh();
    });
  };

  const remove = async (skill) => {
    const result = await deleteSkill(skill.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSkills((current) => current.filter((s) => s.id !== skill.id));
    router.refresh();
  };

  return (
    <section id="skills" aria-labelledby="skills-title" className="scroll-mt-28 py-8">
      <div className="mb-5 flex items-baseline justify-between gap-4 border-b pb-3">
        <h2 id="skills-title" className="text-lg font-semibold tracking-tight">
          Skills
          {skills.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">{skills.length}</span>
          )}
        </h2>
      </div>

      <form onSubmit={add} className="mb-6 flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Skill"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a skill, like React or PostgreSQL"
          className="h-9 sm:flex-1"
          maxLength={100}
        />
        <div className="flex gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger aria-label="Category" className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="submit"
            size="sm"
            disabled={adding || !name.trim()}
            className="h-9 bg-brand hover:bg-brand/90"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-1">Add</span>
          </Button>
        </div>
      </form>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          List the languages, frameworks and tools you&apos;d want a recruiter to search for.
        </p>
      ) : (
        <dl className="space-y-4">
          {groups.map(([group, items]) => (
            <div key={group} className="grid gap-2 sm:grid-cols-[8rem_1fr] sm:gap-4">
              <dt className="pt-1.5 text-sm text-muted-foreground">{group}</dt>
              <dd className="flex flex-wrap gap-1.5">
                {items.map((skill) => (
                  <SkillChip key={skill.id} skill={skill} onRemove={remove} />
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
