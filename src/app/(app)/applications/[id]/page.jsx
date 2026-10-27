import { notFound } from "next/navigation";
import ApplicationEditor from "@/features/applications/ApplicationEditor";
import { getApplicationDetail } from "@/features/applications/data";

export async function generateMetadata({ params }) {
  const detail = await getApplicationDetail(params.id);
  if (!detail) return { title: "Application not found" };
  const { company, role } = detail.application;
  return { title: role ? `${role} at ${company}` : company || "Application" };
}

export default async function ApplicationDetailPage({ params }) {
  const detail = await getApplicationDetail(params.id);
  if (!detail) notFound();

  return (
    <ApplicationEditor
      application={detail.application}
      statusHistory={detail.statusHistory}
      resumeContent={detail.resumeContent}
    />
  );
}
