const total = values => Object.values(values || {}).reduce((sum, value) => sum + (Number.isInteger(value) && value > 0 ? value : 0), 0);
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export function summarizeImport(result) {
  const added = total(result.results), matched = total(result.merged), review = total({ ...result.needsReview, bullets: 0 });
  const bullets = result.bulletsAdded || 0, skippedBullets = result.needsReview?.bullets || 0, dates = result.datesNeedingReview || 0;
  const lines = [[
    plural(added, "new entry", "new entries"),
    `${plural(matched, "existing entry", "existing entries")} matched`,
    `${plural(bullets, "unique bullet")} added`,
  ].join(" · ")];
  if (review) lines.push(`${plural(review, "entry needs", "entries need")} review. Those entries were left unchanged.`);
  if (skippedBullets) lines.push(`${plural(skippedBullets, "bullet")} could not be added because the entry already has 50 bullets.`);
  if (dates) lines.push(`${plural(dates, "imported date")} could not be used. Review the dates below; known dates were preserved.`);
  return { headline: added || bullets ? "Resume imported" : "No duplicate entries added", lines };
}
