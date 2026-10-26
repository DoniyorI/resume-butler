// The classic and new resume editors, side by side while the redesign is reviewed
export function editorViews(resumeId) {
  return [
    { href: `/resumes/${resumeId}`, label: "Classic" },
    { href: `/resumes/${resumeId}/new`, label: "New" },
  ];
}
