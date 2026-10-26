"use client";
import { Loader2, Sparkles, WandSparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CvLibrary from "@/features/resumes/studio/assistant/CvLibrary";
import JobTarget from "@/features/resumes/studio/assistant/JobTarget";
import MatchCard from "@/features/resumes/studio/assistant/MatchCard";
import ReviewList from "@/features/resumes/studio/assistant/ReviewList";
import TailorPicks from "@/features/resumes/studio/assistant/TailorPicks";

function AiAction({ icon: Icon, title, description, onClick, busy, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-brand/50 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-brand" />
      ) : (
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
      )}
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

/**
 * Right-hand panel: tailoring to a job (match score and AI) and the master
 * CV. On narrow screens it's a drawer and also holds the page layout tab.
 */
export default function AssistantPanel({ tab, onTabChange, onClose, layout, job, match, ai, review, cv }) {
  const hasJob = Boolean(job.target.jobDescription.trim());

  return (
    <Tabs value={tab} onValueChange={onTabChange} className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <TabsList className="h-9 flex-1">
          <TabsTrigger value="tailor" className="flex-1 text-xs">
            Tailor
            {review.suggestions.length > 0 && (
              <span className="ml-1.5 rounded-full bg-brand px-1.5 text-[10px] font-semibold text-white">
                {review.suggestions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="cv" className="flex-1 text-xs">
            Master CV
          </TabsTrigger>
          <TabsTrigger value="layout" className="flex-1 text-xs lg:hidden">
            Layout
          </TabsTrigger>
        </TabsList>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 xl:hidden"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <TabsContent value="tailor" className="mt-0 space-y-4 p-4">
          <JobTarget target={job.target} jobOptions={job.options} onChange={job.onChange} />

          {hasJob && (
            <>
              <MatchCard
                result={match.result}
                loading={match.loading}
                error={match.error}
                onAddSkill={match.onAddSkill}
              />

              <section className="space-y-2" aria-label="AI tools">
                <AiAction
                  icon={Sparkles}
                  title="Suggest bullet edits for this job"
                  description="Keywords, numbers and stronger verbs, without changing your facts"
                  onClick={ai.onReview}
                  busy={ai.reviewing}
                />
                <AiAction
                  icon={WandSparkles}
                  title="Pick the best CV entries for this job"
                  description="Chooses experience, projects and skills from your Master CV"
                  onClick={ai.onPick}
                  busy={ai.picking}
                />
              </section>

              {ai.picks && (
                <TailorPicks result={ai.picks} onApply={ai.onApplyPicks} onDiscard={ai.onDiscardPicks} />
              )}
            </>
          )}

          <ReviewList {...review} />
        </TabsContent>

        <TabsContent value="cv" className="mt-0 p-4">
          <CvLibrary cv={cv.data} sections={cv.sections} onAdd={cv.onAdd} />
        </TabsContent>

        <TabsContent value="layout" className="mt-0 lg:hidden">
          {layout}
        </TabsContent>
      </div>
    </Tabs>
  );
}
