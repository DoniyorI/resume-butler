import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function ReportTable({ title, rows, groupLabel, id }) {
  if (!rows.length) return null;
  return (
    <section aria-labelledby={id} data-report-table={id}>
      <h3 id={id} className="mb-2 text-sm font-medium">
        {title}
      </h3>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{groupLabel}</th>
              <th className="px-3 py-2 text-right font-medium">Applications</th>
              <th className="px-3 py-2 text-right font-medium">Responses</th>
              <th className="px-3 py-2 text-right font-medium">Response rate</th>
              <th className="px-3 py-2 text-right font-medium">Interviews</th>
              <th className="px-3 py-2 text-right font-medium">Offers</th>
            </tr>
          </thead>
          <tbody className="divide-y tabular-nums">
            {rows.map((row) => (
              <tr key={row.key} data-group={row.label}>
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  {row.label}
                </th>
                <td className="px-3 py-2 text-right">
                  {row.href && row.applications > 0 ? (
                    <Link href={row.href} className="underline underline-offset-2 hover:text-brand">
                      {row.applications}
                    </Link>
                  ) : (
                    row.applications
                  )}
                </td>
                <td className="px-3 py-2 text-right">{row.responses}</td>
                <td className="px-3 py-2 text-right">
                  {row.tooFew ? (
                    <span className="text-muted-foreground">too few to compare</span>
                  ) : (
                    `${row.responseRate}% (${row.responses} of ${row.applications})`
                  )}
                </td>
                <td className="px-3 py-2 text-right">{row.interviews}</td>
                <td className="px-3 py-2 text-right">{row.offers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Counts and rates from the user's own records, split by source, resume, month
// and workplace. Descriptive only: no advice, no comparison between small groups.
export default function SearchReport({ report }) {
  const description = (
    <>
      Counts from your own records, for the {report.included} of {report.total}{" "}
      {report.total === 1 ? "application" : "applications"} applied {report.windowDays} or more days ago. Responses
      are Reached Out, Interviewed or Offered at any point; interviews include offers. Groups under{" "}
      {report.minGroupSize} applications show counts only (too few to compare). This describes your search only and
      does not predict anything.
    </>
  );
  const body = (
    <>
      {report.included === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Not enough history yet. Applications appear here {report.windowDays} days after you applied.
        </p>
      ) : (
        <>
          <ReportTable id="report-source" title="By source" groupLabel="Source" rows={report.bySource} />
          <ReportTable id="report-site" title="By job site" groupLabel="Site" rows={report.bySite} />
          <ReportTable id="report-resume" title="By resume used" groupLabel="Resume" rows={report.byResume} />
          <ReportTable id="report-month" title="By month applied" groupLabel="Month" rows={report.byMonth} />
          <ReportTable id="report-workplace" title="By workplace type" groupLabel="Workplace" rows={report.byWorkplace} />
        </>
      )}
    </>
  );

  return (
    <Card id="search-report">
      <CardHeader>
        <CardTitle className="text-lg">Search report</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">{body}</CardContent>
    </Card>
  );
}
