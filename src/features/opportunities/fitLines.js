// Wording shared by the fit card and the interview preparation page. Pure, so
// server code can use it (JobFit.jsx is a client module).

const article = (term) => (/^[aeiou]/i.test(term) ? "an" : "a");

export const CHECK_KINDS = {
  "work-authorization": "Work authorisation",
  clearance: "Clearance",
  citizenship: "Citizenship",
  onsite: "On-site",
  relocation: "Relocation",
  travel: "Travel",
};

export function yearsLine(years) {
  if (!years || years.status === "not-stated" || years.required == null) return null;
  if (years.status === "unknown")
    return `Asks for ${years.required}+ years; add dates to your experience to compare.`;
  return `Asks for ${years.required}+ years; your dated experience covers about ${years.have} ${years.have === 1 ? "year" : "years"}.`;
}

export function degreeLine(degree) {
  if (!degree || degree.status === "not-stated" || !degree.required) return null;
  const asks = `Asks for ${article(degree.required)} ${degree.required}`;
  if (degree.status === "unknown") return `${asks}: add your education to compare.`;
  if (degree.status === "meets") return `${asks}: ${degree.inProgress ? "in progress" : "shown in your education"}.`;
  return `${asks}: not shown in your education.`;
}
