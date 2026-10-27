"use client";
import { Briefcase, FolderKanban, GraduationCap, Plus, Wrench } from "lucide-react";
import { formatMonthYear } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidePanel } from "@/components/shared/SidePanel";
import { cvToResumeItem as toResumeItem, skillLines as skillGroups } from "@/features/resumes/resumeDocument";

const shortDate = (value) => formatMonthYear(value, { month: "short" });

function groupByCategory(skills) {
  return skills.reduce((acc, skill) => {
    const category = skill.category || "Other";
    (acc[category] ||= []).push(skill);
    return acc;
  }, {});
}

function Bullets({ bullets }) {
  if (!bullets.length) return null;
  return (
    <ul className="mt-1.5 space-y-0.5">
      {bullets.map((bullet, i) => (
        <li key={i} className="text-xs text-gray-500 pl-3 relative">
          <span className="absolute left-0">•</span>
          {bullet}
        </li>
      ))}
    </ul>
  );
}

function Section({ icon: Icon, title, count, children }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-brand" />
        <h3 className="font-semibold text-sm">{title}</h3>
        <Badge variant="secondary" className="text-xs">
          {count}
        </Badge>
      </div>
      {count === 0 ? (
        <p className="text-xs text-gray-400">No {title.toLowerCase()} in CV</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

function ItemCard({ children, onAdd }) {
  return (
    <div className="border rounded-md p-3 hover:border-brand transition-colors">
      <div className="flex gap-2">
        <div className="flex-grow min-w-0">{children}</div>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 flex-shrink-0 border-brand text-brand hover:bg-green-50 self-start"
          onClick={onAdd}
        >
          <Plus size={14} />
        </Button>
      </div>
    </div>
  );
}

// Side panel listing the master CV; + adds an item to the resume.
// onAdd(sectionId, item) receives resume-shaped items.
export default function CvDrawer({ cv, open, onClose, onAdd }) {
  const skillsByCategory = groupByCategory(cv.skills);

  return (
    <SidePanel open={open} onClose={onClose} title="Master CV" subtitle="Click + to add items to this resume">
      <div className="p-4 space-y-6">
        <Section icon={GraduationCap} title="Education" count={cv.education.length}>
          {cv.education.map((edu) => (
            <ItemCard key={edu.id} onAdd={() => onAdd("education", toResumeItem.education(edu))}>
              <p className="font-medium text-sm">{edu.school}</p>
              <p className="text-xs text-gray-500">
                {edu.degreeType}
                {edu.major ? ` in ${edu.major}` : ""}
              </p>
              {(edu.startDate || edu.endDate) && (
                <p className="text-xs text-gray-400">
                  {shortDate(edu.startDate)} - {shortDate(edu.endDate)}
                </p>
              )}
              {edu.gpa && <p className="text-xs text-gray-400">GPA: {edu.gpa}</p>}
            </ItemCard>
          ))}
        </Section>

        <Section icon={Briefcase} title="Experience" count={cv.experience.length}>
          {cv.experience.map((exp) => (
            <ItemCard key={exp.id} onAdd={() => onAdd("experience", toResumeItem.experience(exp))}>
              <p className="font-medium text-sm">{exp.company}</p>
              <p className="text-xs text-gray-500">{exp.position}</p>
              <p className="text-xs text-gray-400">
                {shortDate(exp.startDate)} - {exp.currentlyWorking ? "Present" : shortDate(exp.endDate)}
              </p>
              <Bullets bullets={exp.bullets} />
            </ItemCard>
          ))}
        </Section>

        <Section icon={FolderKanban} title="Projects" count={cv.projects.length}>
          {cv.projects.map((proj) => (
            <ItemCard key={proj.id} onAdd={() => onAdd("projects", toResumeItem.projects(proj))}>
              <p className="font-medium text-sm">{proj.name}</p>
              {proj.description && <p className="text-xs text-gray-500">{proj.description}</p>}
              {(proj.startDate || proj.endDate) && (
                <p className="text-xs text-gray-400">
                  {shortDate(proj.startDate)} - {shortDate(proj.endDate)}
                </p>
              )}
              <Bullets bullets={proj.bullets} />
            </ItemCard>
          ))}
        </Section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wrench size={16} className="text-brand" />
              <h3 className="font-semibold text-sm">Skills</h3>
              <Badge variant="secondary" className="text-xs">
                {cv.skills.length}
              </Badge>
            </div>
            {cv.skills.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-brand hover:bg-green-50 h-7"
                onClick={() => skillGroups(cv.skills).forEach((group) => onAdd("skills", group))}
              >
                <Plus size={12} className="mr-1" /> Add All
              </Button>
            )}
          </div>
          {cv.skills.length === 0 ? (
            <p className="text-xs text-gray-400">No skills in CV</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(skillsByCategory).map(([category, skills]) => (
                <div key={category}>
                  <p className="text-xs text-gray-500 font-medium mb-1">{category}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((skill) => (
                      <span
                        key={skill.id}
                        className="text-xs bg-green-50 border border-green-200 px-2 py-0.5 rounded-full"
                      >
                        {skill.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </SidePanel>
  );
}
