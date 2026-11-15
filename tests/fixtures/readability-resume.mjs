// A synthetic resume (a made-up person) whose PDF is tests/fixtures/readability-resume.pdf.
// Regenerate the PDF with: node --use-system-ca --import ./tests/register.mjs scripts/build-readability-fixture.mjs
export const readabilityResume = {
  header: { name: "Alex Example", email: "alex@example.test", phone: "555-0100", linkedin: "https://www.linkedin.com/in/alex-example", github: "https://github.com/alex-example" },
  education: [
    { school: "Fixture State University", location: "Springfield, IL", degreeType: "Bachelor of Science", major: "Computer Science", gpa: "3.8", startDate: "2014-09-01", endDate: "2018-05-01" },
  ],
  experience: [
    {
      companyName: "Northwind Labs", location: "Remote", position: "Senior Software Engineer", startDate: "2021-01-01", currentlyWorking: true,
      description: [
        "Built an efficient scheduling service in TypeScript that served 40 internal clients",
        "Cut office report load time by 50% after profiling slow PostgreSQL queries",
        "Led the migration of a monolithic workflow engine to event-driven services, coordinating four teams across two time zones and shipping with no customer-facing downtime",
        "Mentored three engineers",
      ],
    },
    {
      companyName: "Contoso Systems", location: "Chicago, IL", position: "Software Engineer", startDate: "2018-06-01", endDate: "2020-12-01",
      description: ["Wrote integration tests that caught regressions before release", "Reduced build times from 12 minutes to 4 minutes"],
    },
  ],
  projects: [
    { projectName: "Open Resume Linter", startDate: "2020-01-01", endDate: "2020-06-01", description: ["Published a command-line tool that checks résumé files for formatting problems"] },
  ],
  skills: [
    { header: "Languages", skills: "TypeScript, Python, SQL, Go" },
    { header: "Tools", skills: ["Docker", "PostgreSQL", "Git"] },
  ],
  certifications: [
    { id: "00000000-0000-4000-8000-0000000000c1", title: "Fixture Cloud Practitioner", subtitle: "Example Certification Board", date: "2022", url: "", description: [] },
  ],
  order: [
    { id: "experience", title: "Experience" },
    { id: "education", title: "Education" },
    { id: "projects", title: "Projects" },
    { id: "skills", title: "Technical Skills" },
    { id: "certifications", title: "Certifications" },
  ],
};
