import { notFound } from "next/navigation";
import ApplicationEditor from "@/features/applications/ApplicationEditor";
import SubmissionPanel from "@/features/applications/SubmissionPanel";
import { getApplicationDetail } from "@/features/applications/data";
import NextSteps from "@/features/activities/NextSteps";
import { ACTIVITY_KINDS } from "@/features/activities/kinds";
import { requirePageUser } from "@/server/auth";
import { listActivities } from "@/server/activities/service";

export async function generateMetadata({ params }) {
  const detail = await getApplicationDetail(params.id);
  if (!detail) return { title: "Application not found" };
  const { company, role } = detail.application;
  return { title: role ? `${role} at ${company}` : company || "Application" };
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

  return (
    <ApplicationEditor
      application={detail.application}
      statusHistory={detail.statusHistory}
      resumeContent={detail.resumeContent}
      submissionPanel={<SubmissionPanel application={detail.application} />}
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
