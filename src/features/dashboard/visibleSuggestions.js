export const SUGGESTION_LIMIT = 4;

// Which suggested next steps show: the first few, or all when expanded.
// `hiddenCount` is what "Show N more" would reveal; `canToggle` says whether the button exists.
export function visibleSuggestions(suggestions, expanded, limit = SUGGESTION_LIMIT) {
  const hiddenCount = Math.max(0, suggestions.length - limit);
  return {
    items: expanded || hiddenCount === 0 ? suggestions : suggestions.slice(0, limit),
    hiddenCount,
    canToggle: hiddenCount > 0,
  };
}
