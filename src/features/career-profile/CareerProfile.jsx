import IdentityRail from "@/features/career-profile/IdentityRail";
import ExperienceSection from "@/features/career-profile/ExperienceSection";
import EducationSection from "@/features/career-profile/EducationSection";
import ProjectsSection from "@/features/career-profile/ProjectsSection";
import SkillsSection from "@/features/career-profile/SkillsSection";
import CertificationsSection from "@/features/career-profile/CertificationsSection";

// Profile and master CV on one page: identity on the left, the CV as a
// readable document on the right, every entry editable where it appears
export default function CareerProfile({ profile, cv }) {
  const sections = [
    { id: "experience", title: "Experience", count: cv.experience.length },
    { id: "education", title: "Education", count: cv.education.length },
    { id: "projects", title: "Projects", count: cv.projects.length },
    { id: "skills", title: "Skills", count: cv.skills.length },
    { id: "certifications", title: "Certifications", count: cv.certifications.length },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-12">
      <IdentityRail profile={profile} cv={cv} sections={sections} />

      <div className="min-w-0">
        {/* Section shortcuts on small screens, where the rail's list is hidden */}
        <nav aria-label="CV sections" className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="shrink-0 rounded-full border px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
            >
              {section.title} <span className="tabular-nums">{section.count}</span>
            </a>
          ))}
        </nav>

        <div className="rounded-xl border bg-background px-5 py-6 sm:px-8 sm:py-8">
          <ExperienceSection initialItems={cv.experience} />
          <EducationSection initialItems={cv.education} />
          <ProjectsSection initialItems={cv.projects} />
          <SkillsSection initialItems={cv.skills} />
          <CertificationsSection initialItems={cv.certifications} />
        </div>
      </div>
    </div>
  );
}
