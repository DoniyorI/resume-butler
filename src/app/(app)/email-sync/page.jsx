import Link from "next/link";
import { requirePageUser } from "@/server/auth";
import { getEmailSyncData } from "@/features/email-sync/data";
import EmailSync from "@/features/email-sync/EmailSync";
import GmailSetupGuide from "@/features/email-sync/GmailSetupGuide";
import ScanHistory from "@/features/email-sync/ScanHistory";
import SuggestionsReview from "@/features/suggestions/SuggestionsReview";
import { isGmailConfigured } from "@/server/email/gmailClient";
import { GMAIL_SETUP_MESSAGE } from "@/server/email/connection";

// What /api/gmail/callback reports back (?gmail=...); anything else shows nothing
const GMAIL_NOTICES = {
  connected: { ok: true, text: "Gmail is connected with Google. Scan now, or turn on the daily sync." },
  denied: { ok: false, text: "Gmail was not connected: Google sign-in was cancelled." },
  scope: { ok: false, text: "Gmail was not connected: the permission to read your email was not ticked on Google's page. Try again and leave it ticked." },
  expired: { ok: false, text: "That Google sign-in expired or was started elsewhere. Please try again." },
  unavailable: { ok: false, text: "Connecting with Google is not set up on this server yet. Use an app password for now." },
  setup: { ok: false, text: GMAIL_SETUP_MESSAGE },
  failed: { ok: false, text: "Gmail could not be connected. Please try again." },
};

export const metadata = { title: "Inbox" };

export default async function EmailSyncPage({ searchParams }) {
  const { supabase, user } = await requirePageUser();
  const outcome = String(searchParams?.gmail ?? "");
  const notice = Object.hasOwn(GMAIL_NOTICES, outcome) ? GMAIL_NOTICES[outcome] : null;
  const { connection, history, suggestions } = await getEmailSyncData(supabase, user.id);

  return (
    <div className="flex flex-col w-full min-h-screen pt-24 px-5 md:px-10 pb-10">
      <h1 className="text-2xl font-semibold text-brand mb-2">Inbox</h1>
      <p className="text-sm text-gray-500 mb-6">
        Scan your email for application updates, then approve the ones you want in your tracker. To log
        applications as you submit them, connect the{" "}
        <Link href="/extension" className="font-medium text-brand hover:underline">
          browser extension
        </Link>
        .
      </p>
      {notice && (
        <p
          role="status"
          className={`mb-6 rounded-md border px-4 py-3 text-sm ${notice.ok ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}
        >
          {notice.text}
        </p>
      )}
      <EmailSync
        connection={connection}
        gmailAvailable={isGmailConfigured()}
        guide={<GmailSetupGuide />}
        history={<ScanHistory items={history} />}
        review={<SuggestionsReview suggestions={suggestions} />}
      />
    </div>
  );
}
