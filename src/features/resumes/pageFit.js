// Keep page-fit decisions independent of React and browser layout.
export const LINE_PX = 16;
// Aim to use most of the available page without treating an estimate as proof
// of PDF overflow. The compiled PDF is authoritative for page count.
export function pageFit({ usedPx, limitPx }, pdfPages = null) {
  const measured = Number.isFinite(usedPx) && usedPx >= 0 && Number.isFinite(limitPx) && limitPx > 0;
  const ratio = measured ? (usedPx / limitPx) * 100 : 0;
  const confirmed = Number.isInteger(pdfPages) && pdfPages > 0;
  const spare = measured ? (limitPx - usedPx) / LINE_PX : 0;
  const lines = measured ? Math.max(1, Math.round(Math.abs(spare))) : 0;
  const state = confirmed ? (pdfPages === 1 ? "pdf-fits" : "pdf-over")
    : !measured ? "unmeasured" : ratio > 100 ? "over" : ratio >= 90 ? "fits" : "underfilled";
  const tone = state === "pdf-over" ? "red"
    : state === "unmeasured" ? "neutral"
      : state === "over" || (measured && ratio < 90) ? "amber" : "green";
  return {
    percent: Math.round(ratio * 10) / 10,
    state, tone, lines, measured,
    over: confirmed ? pdfPages > 1 : measured && ratio > 100,
  };
}
