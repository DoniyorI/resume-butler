// The tabs of /insights, in order; the first is the default
export const INSIGHT_TABS = [
  { value: "activity", label: "Activity" },
  { value: "flow", label: "Application flow" },
  { value: "report", label: "Search report" },
];

// Anything but a known tab (missing, repeated, misspelled) is the first one
export function parseInsightTab(value) {
  return INSIGHT_TABS.some((tab) => tab.value === value) ? value : INSIGHT_TABS[0].value;
}
