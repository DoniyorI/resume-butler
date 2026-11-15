import Link from "next/link";
import { ChevronRight, ExternalLink, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PrintButton from "@/features/interviews/PrintButton";
import { ACTIVITY_KIND_LABELS, CONTACT_CHANNEL_LABELS, isValidTimeZone } from "@/features/activities/kinds";
import { PREP_TEXT } from "@/server/interviews/prepare";
import { formatShortDate } from "@/lib/dates";
import { safeHttpUrl } from "@/lib/safeUrl";

// The interview preparation page: facts arranged from the posting, the Master
// CV and what the user recorded, each as a quote. Server-rendered; the only
// client piece is the Print button.

// "Nov 16, 2026, 2:30 PM EST": the time in the zone the step was entered in
function stepTime(step) {
  if (step.startsAt) {
    const zone = isValidTimeZone(step.timeZone) ? step.timeZone : "UTC";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(step.startsAt));
  }
  return step.dueOn ? formatShortDate(step.dueOn) : "";
}

function Quote({ children, from }) {
  return (
    <p className="mt-1 break-words text-sm leading-relaxed">
      “{children}”{from ? <span className="text-xs text-muted-foreground"> — {from}</span> : null}
    </p>
  );
}

function RequirementItem({ item }) {
  return (
    <li className="space-y-1 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="break-words font-medium">{item.label}</span>
        <span className="text-xs text-muted-foreground">{item.importance === "required" ? "Required" : "Preferred"}</span>
      </div>
      {item.alternativeLabels?.length ? (
        <p className="break-words text-xs text-muted-foreground">
          {PREP_TEXT.alsoAccepted} {item.alternativeLabels.join(", ")}
        </p>
      ) : null}
      {item.postingQuote ? (
        <blockquote className="break-words border-l-2 pl-3 text-sm italic text-muted-foreground">
          <span className="not-italic">The posting: </span>“{item.postingQuote}”
        </blockquote>
      ) : null}
      {item.quotes.map((quote, index) => (
        <Quote key={index} from={quote.from}>
          {quote.text}
        </Quote>
      ))}
    </li>
  );
}

function Group({ group }) {
  return (
    <section aria-labelledby={`prep-${group.key}`}>
      <Card>
        <CardHeader className="pb-1">
          <CardTitle id={`prep-${group.key}`} className="text-base">
            {group.title} <span className="text-sm font-normal text-muted-foreground">({group.items.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {group.items.map((item) => (
              <RequirementItem key={`${item.importance}:${item.term}`} item={item} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

function Upcoming({ step, applicationId, past }) {
  if (!step) {
    return (
      <p className="text-sm text-muted-foreground">
        No interview scheduled. Add one under{" "}
        <Link href={`/applications/${applicationId}?step=interview#next-steps`} className="font-medium text-brand hover:underline">
          Next steps
        </Link>
        .
      </p>
    );
  }
  const href = safeHttpUrl(step.link);
  const contact = [step.contactName, CONTACT_CHANNEL_LABELS[step.contactChannel]].filter(Boolean).join(" · ");
  return (
    <section aria-label="Upcoming interview">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4 text-brand" /> {step.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            {ACTIVITY_KIND_LABELS[step.kind]} · <time dateTime={step.startsAt || step.dueOn || undefined}>{stepTime(step)}</time>
          </p>
          {contact ? <p className="break-words text-muted-foreground">{contact}</p> : null}
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all font-medium text-brand hover:underline">
              <ExternalLink className="h-3.5 w-3.5 shrink-0" /> Open link
            </a>
          ) : null}
          {step.notes ? <p className="whitespace-pre-line break-words text-foreground/80">{step.notes}</p> : null}
          {past > 0 ? (
            <p className="text-xs text-muted-foreground">
              {past} earlier {past === 1 ? "interview step is" : "interview steps are"} marked done.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

export default function PrepareView({ prep, applicationId }) {
  const { source, posting, upcoming, groups, stories, checks, answers } = prep;
  const heading = posting.role ? `Prepare for ${posting.role} at ${posting.company || "this company"}` : `Prepare for ${posting.company || "this application"}`;
  return (
    <div className="rb-prep mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 pb-16 pt-[85px] md:px-6">
      <header className="flex flex-col gap-3">
        <nav aria-label="Breadcrumb" className="rb-no-print flex items-center gap-1 text-sm text-muted-foreground">
          <Link href={`/applications/${applicationId}`} className="hover:text-foreground">
            Back to the application
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">Prepare</span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 break-words text-2xl font-semibold">{heading}</h1>
          <PrintButton />
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          {source.kind === "submitted" ? (
            <p className="break-words">
              Submitted {formatShortDate(source.submittedOn)}
              {source.resumeTitle ? ` with “${source.resumeTitle}”` : ""}.{" "}
              <Link href={`/submissions/${source.submissionId}`} className="font-medium text-brand hover:underline">
                See what you sent
              </Link>
            </p>
          ) : null}
          {source.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      </header>

      <Upcoming step={upcoming} applicationId={applicationId} past={prep.past} />

      {!posting.hasDescription ? (
        <p className="text-sm text-muted-foreground">
          {PREP_TEXT.addDescription}{" "}
          <Link href={`/applications/${applicationId}`} className="font-medium text-brand hover:underline">
            Open the application
          </Link>
        </p>
      ) : !posting.fitAvailable ? (
        <p className="text-sm text-muted-foreground">{PREP_TEXT.fitUnavailable}</p>
      ) : posting.cvEmpty ? (
        <p className="text-sm text-muted-foreground">
          <Link href="/profile" className="font-medium text-brand hover:underline">
            {PREP_TEXT.addCv}
          </Link>
        </p>
      ) : null}

      {groups.map((group) => (
        <Group key={group.key} group={group} />
      ))}

      {stories.length ? (
        <section aria-labelledby="prep-stories">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle id="prep-stories" className="text-base">
                {PREP_TEXT.stories}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {stories.map((story) => (
                  <li key={story.text} className="py-3">
                    <Quote from={story.from}>{story.text}</Quote>
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      {PREP_TEXT.covers} {story.covers.join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {checks.length ? (
        <section aria-labelledby="prep-checks">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle id="prep-checks" className="text-base">
                {PREP_TEXT.checks}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {checks.map((check) => (
                  <li key={check.kind} className="break-words py-2 text-sm">
                    <span className="font-medium">{check.label}:</span>{" "}
                    <span className="text-muted-foreground">{check.kind === "years" || check.kind === "degree" ? check.text : `“${check.text}”`}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {answers.length ? (
        <section aria-labelledby="prep-answers">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle id="prep-answers" className="text-base">
                {PREP_TEXT.answers}
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {answers.map((item, index) => (
                <div key={index} className="py-3">
                  <h3 className="break-words text-sm font-medium">{item.question}</h3>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.answer}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-muted-foreground">{PREP_TEXT.footer}</p>
    </div>
  );
}
