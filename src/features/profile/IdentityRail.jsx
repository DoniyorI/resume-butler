"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { summarizeImport } from "./importSummary";
import {
  Check,
  Circle,
  FileUp,
  Github,
  Globe,
  Link2,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeHttpUrl } from "@/lib/safeUrl";
import { displayUrl, fullName, initials } from "@/features/profile/format";
import ProfileDialog from "@/features/profile/ProfileDialog";
import { cvStrength } from "@/features/profile/strength";

function ContactLine({ icon: Icon, children, href }) {
  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{children}</span>
    </>
  );
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 text-sm hover:text-brand"
    >
      {content}
    </a>
  ) : (
    <p className="flex items-center gap-2.5 text-sm">{content}</p>
  );
}

async function sendResumeFile(file) {
  const formData = new FormData(); formData.append("file", file);
  return fetch("/api/parse-resume", { method: "POST", body: formData });
}

export function ResumeImport({ uploadFile = sendResumeFile }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const upload = async file => {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true);
    setResult(null); setError("");
    try {
      const response = await uploadFile(file);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setError(data.error || "Couldn't import that resume. Your existing CV is kept."); return; }
      setResult(summarizeImport(data));
      router.refresh();
    } catch { setError("Couldn't reach the server. Keep your resume file and try again."); }
    finally { inFlight.current = false; setPending(false); }
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept=".pdf,.txt" className="sr-only" tabIndex={-1}
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) upload(file); }} />
      <Button variant="outline" className="w-full" onClick={() => inputRef.current?.click()} disabled={pending}>
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
        {pending ? "Reading and matching…" : "Import from a resume"}
      </Button>
      <p className="mt-1.5 text-xs text-muted-foreground">PDF or text. Matches existing entries and adds unique bullets. Your edits are kept.</p>
      {pending && <p role="status" className="mt-2 text-xs text-muted-foreground">Extracting your resume, then checking your Master CV for matches…</p>}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      {result && <div role="status" className="mt-3 space-y-1.5 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">{result.headline}</p>
        {result.lines.map(line => <p key={line}>{line}</p>)}
      </div>}
    </div>
  );
}

// An unfinished check takes you to the place that fixes it
function CheckLink({ check, onEditProfile }) {
  const content = (
    <>
      <Circle className="h-3.5 w-3.5 text-muted-foreground" /> {check.label}
    </>
  );
  const className = "flex items-center gap-2 text-left text-sm hover:text-brand";
  return check.section === "profile" ? (
    <button type="button" onClick={onEditProfile} className={className}>
      {content}
    </button>
  ) : (
    <a href={`#${check.section}`} className={className}>
      {content}
    </a>
  );
}

// The sticky left column: who you are, how complete the CV is, and where to go next
export default function IdentityRail({ profile, cv, sections }) {
  const [editing, setEditing] = useState(false);
  const strength = cvStrength(profile, cv);
  const name = fullName(profile);

  const links = [
    { icon: Linkedin, url: profile.linkedin },
    { icon: Github, url: profile.github },
    { icon: Globe, url: profile.portfolio },
    { icon: Link2, url: profile.otherLinks },
  ].filter((link) => safeHttpUrl(link.url));

  return (
    <aside className="space-y-6 lg:sticky lg:top-24">
      <div className="rounded-xl border bg-[#F6FAF8] p-5">
        <div className="flex items-start justify-between gap-3">
          <div
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-semibold text-white"
          >
            {initials(profile)}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            className="h-8 text-muted-foreground"
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Button>
        </div>
        <h1 className="mt-4 text-2xl font-semibold leading-tight tracking-tight">
          {name || "Add your name"}
        </h1>
        {profile.location && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {profile.location}
          </p>
        )}

        <div className="mt-5 space-y-2">
          {profile.email && <ContactLine icon={Mail}>{profile.email}</ContactLine>}
          {profile.phone && <ContactLine icon={Phone}>{profile.phone}</ContactLine>}
          {links.map(({ icon, url }) => (
            <ContactLine key={url} icon={icon} href={safeHttpUrl(url)}>
              {displayUrl(url)}
            </ContactLine>
          ))}
          {links.length === 0 && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm text-brand hover:underline"
            >
              Add LinkedIn or GitHub
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">CV strength</h2>
          <span className="text-sm tabular-nums text-muted-foreground">{strength.percent}%</span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={strength.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="CV strength"
        >
          <div
            className="h-full rounded-full bg-brand transition-[width]"
            style={{ width: `${strength.percent}%` }}
          />
        </div>
        <ul className="mt-3 space-y-1.5">
          {strength.checks.map((check) => (
            <li key={check.id}>
              {check.done ? (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-3.5 w-3.5 text-brand" /> {check.label}
                </span>
              ) : (
                <CheckLink check={check} onEditProfile={() => setEditing(true)} />
              )}
            </li>
          ))}
        </ul>
      </div>

      <nav aria-label="CV sections" className="hidden lg:block">
        <ul className="space-y-0.5">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {section.title}
                <span className="tabular-nums">{section.count}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <ResumeImport />

      <ProfileDialog open={editing} onOpenChange={setEditing} profile={profile} />
    </aside>
  );
}
