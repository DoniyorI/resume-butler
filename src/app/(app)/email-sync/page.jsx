import Link from "next/link";
import { requirePageUser } from "@/server/auth";
import { getEmailSyncData } from "@/features/email-sync/data";
import EmailSync from "@/features/email-sync/EmailSync";
import GmailSetupGuide from "@/features/email-sync/GmailSetupGuide";
import ScanHistory from "@/features/email-sync/ScanHistory";
import SuggestionsReview from "@/features/suggestions/SuggestionsReview";

export const metadata = { title: "Email Sync" };

export default async function EmailSyncPage() {
  const { supabase, user } = await requirePageUser();
  const { connection, history, suggestions } = await getEmailSyncData(supabase, user.id);

  return (
    <div className="flex flex-col w-full min-h-screen pt-24 px-5 md:px-10 pb-10">
      <h1 className="text-2xl font-semibold text-brand mb-2">Email Sync</h1>
      <p className="text-sm text-gray-500 mb-6">
        Scan your email for application updates, then approve the ones you want in your tracker. To log
        applications as you submit them, connect the{" "}
        <Link href="/extension" className="font-medium text-brand hover:underline">
          browser extension
        </Link>
        .
      </p>
      <EmailSync
        connection={connection}
        guide={<GmailSetupGuide />}
        history={<ScanHistory items={history} />}
        review={<SuggestionsReview suggestions={suggestions} />}
      />
    </div>
  );
}
