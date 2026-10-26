import { Award, Briefcase, FolderKanban, GraduationCap, Wrench } from "lucide-react";
import { requirePageUser } from "@/server/auth";
import { getCvData } from "@/features/cv/data";
import CvEditor from "@/features/cv/CvEditor";

export const metadata = { title: "Master CV" };

function StatBadge({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border text-sm">
      <Icon size={14} className="text-brand" />
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-brand">{count}</span>
    </div>
  );
}

export default async function CvPage() {
  const { supabase, user } = await requirePageUser();
  const cv = await getCvData(supabase, user.id);

  const totalItems =
    cv.education.length +
    cv.experience.length +
    cv.projects.length +
    cv.skills.length +
    cv.certifications.length;

  return (
    <div className="flex flex-col w-full min-h-screen py-16 px-6 md:px-10 my-10">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-semibold text-brand">Master CV</h1>
        <p className="pt-1 font-light text-sm text-gray-500 max-w-lg mx-auto">
          Add everything here — all your experience, projects, education, and skills. When you apply to a job,
          we&apos;ll pick the most relevant items to build a tailored resume.
        </p>
      </div>

      {totalItems > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          <StatBadge icon={GraduationCap} label="Education" count={cv.education.length} />
          <StatBadge icon={Briefcase} label="Experience" count={cv.experience.length} />
          <StatBadge icon={FolderKanban} label="Projects" count={cv.projects.length} />
          <StatBadge icon={Wrench} label="Skills" count={cv.skills.length} />
          <StatBadge icon={Award} label="Certs" count={cv.certifications.length} />
        </div>
      )}

      <CvEditor data={cv} />
    </div>
  );
}
