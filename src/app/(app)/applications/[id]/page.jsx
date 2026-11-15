import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import JobFit from "@/features/opportunities/JobFit";
import { readResumeForEditing } from "@/features/resumes/resumeDocument";
import { assessFit } from "@/server/fit/assessFit";
import { loadMasterCv } from "@/server/resume/loadCv";
import ApplicationEditor from "@/features/applications/ApplicationEditor";
import SubmissionPanel from "@/features/applications/SubmissionPanel";
import { getApplicationDetail } from "@/features/applications/data";
import OfferCard from "@/features/offers/OfferCard";
import NextSteps from "@/features/activities/NextSteps";
import { ACTIVITY_KINDS } from "@/features/activities/kinds";
import { requirePageUser } from "@/server/auth";
import { listActivities } from "@/server/activities/service";
import { getOffer } from "@/server/offers/service";

export async function generateMetadata({ params }) {
  const detail = await getApplicationDetail(params.id);
  if (!detail) return { title: "Application not found" };
  const { company, role } = detail.application;
  return { title: role ? `${role} at ${company}` : company || "Application" };
}

// Shorter than this, a description can't name requirements worth comparing
const MIN_DESCRIPTION = 40;

// How the saved job description compares with the Master CV (and the linked
// resume). Fails soft: on any error the page just has no fit card.
async function loadFit(supabase, userId, detail) {
  const { jobDescription } = detail.application;
  if (typeof jobDescription !== "string" || jobDescription.trim().length < MIN_DESCRIPTION) return null;
  try {
    const cv = await loadMasterCv(supabase, userId);
    const document = detail.resumeContent ? readResumeForEditing(detail.resumeContent) : null;
    return assessFit({
      jobDescription,
      cv,
      resumeContent: document && !document.readOnly ? document.content : null,
    });
  } catch (error) {
    console.warn("Could not assess fit for the application:", error.message);
    return null;
  }
}

export default async function ApplicationDetailPage({ params, searchParams }) {
  const detail = await getApplicationDetail(params.id);
  if (!detail) notFound();

  // Before migration 020 this is { items: [], setupPending: true }; any other
  // failure shows a quiet line and the rest of the page still renders
  const { supabase, user } = await requirePageUser();
  const activities = await listActivities(supabase, user.id, { applicationId: detail.application.id }).catch(
    (error) => {
      console.warn("Could not load next steps:", error.message);
      return { items: [], setupPending: false, unavailable: true };
    }
  );
  // ?step=interview (from a dashboard suggestion) opens the add form on that kind
  const step = ACTIVITY_KINDS.includes(searchParams?.step) ? searchParams.step : undefined;

  // Shown for an Offered application or one that already has an offer record;
  // before migration 022 it is one quiet line. Any other failure hides the card.
  const offer = await getOffer(supabase, user.id, detail.application.id).catch((error) => {
    console.warn("Could not load the offer:", error.message);
    return null;
  });
  const showOffer = Boolean(offer) && (detail.application.status === "Offered" || Boolean(offer.offer));

  const hasInterviewStep = activities.items.some(
    (a) => a.status === "open" && (a.kind === "interview" || a.kind === "recruiter_screen")
  );

  const fit = await loadFit(supabase, user.id, detail);
  const resumeId = detail.application.resumeId;

  return (
    <ApplicationEditor
      application={detail.application}
      statusHistory={detail.statusHistory}
      resumeContent={detail.resumeContent}
      hasInterviewStep={hasInterviewStep}
      submissionPanel={<SubmissionPanel application={detail.application} />}
      fit={
        fit ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Fit for this job</CardTitle>
            </CardHeader>
            <CardContent>
              <JobFit
                fit={fit}
                described
                tailor={
                  resumeId ? (
                    <Link href={`/resumes/${resumeId}`} className="text-xs font-medium text-brand hover:underline">
                      Open linked resume
                    </Link>
                  ) : null
                }
              />
              <p className="text-xs text-muted-foreground">Based on the saved job description.</p>
            </CardContent>
          </Card>
        ) : null
      }
      offer={
        showOffer ? (
          <OfferCard
            applicationId={detail.application.id}
            offer={offer.offer}
            decideBy={offer.decideBy}
            deadlineAvailable={offer.deadlineAvailable}
            setupPending={offer.setupPending}
          />
        ) : null
      }
      nextSteps={
        <NextSteps
          applicationId={detail.application.id}
          items={activities.items}
          setupPending={activities.setupPending}
          unavailable={Boolean(activities.unavailable)}
          initialKind={step}
        />
      }
    />
  );
}
