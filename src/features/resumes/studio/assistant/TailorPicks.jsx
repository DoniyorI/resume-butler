import { Button } from "@/components/ui/button";

function PickList({ title, picks }) {
  if (picks.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="mt-1 space-y-1.5">
        {picks.map((pick) => (
          <li key={pick.title} className="text-sm">
            <span className="font-medium">{pick.title}</span>
            {pick.reason && <span className="block text-xs text-muted-foreground">{pick.reason}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// The AI's choice of master CV entries for the job, shown before it replaces anything
export default function TailorPicks({ result, onApply, onDiscard }) {
  const { content, picks } = result;
  const skillCount = content.skills.reduce((sum, line) => sum + line.skills.split(",").length, 0);

  return (
    <section
      className="space-y-3 rounded-lg border border-brand/40 bg-brand/5 p-3"
      aria-labelledby="picks-heading"
    >
      <div>
        <h3 id="picks-heading" className="text-sm font-semibold">
          Best CV entries for this job
        </h3>
        <p className="text-xs text-muted-foreground">
          Applying replaces the education, experience, projects and skills on this page with these entries
          from your Master CV. You can undo it.
        </p>
      </div>
      <PickList title="Experience" picks={picks.experience} />
      <PickList title="Projects" picks={picks.projects} />
      <p className="text-xs text-muted-foreground">
        {content.education.length} education {content.education.length === 1 ? "entry" : "entries"} and{" "}
        {skillCount} skills in {content.skills.length} {content.skills.length === 1 ? "line" : "lines"}
      </p>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1" onClick={onApply}>
          Apply to this resume
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </section>
  );
}
