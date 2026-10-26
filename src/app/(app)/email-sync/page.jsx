import { requirePageUser } from "@/server/auth";
import { getEmailSyncData } from "@/features/email-sync/data";
import EmailSync from "@/features/email-sync/EmailSync";
import GmailSetupGuide from "@/features/email-sync/GmailSetupGuide";
import ScanHistory from "@/features/email-sync/ScanHistory";

export const metadata = { title: "Email Sync" };

export default async function EmailSyncPage() {
  const { supabase, user } = await requirePageUser();
  const { connection, history } = await getEmailSyncData(supabase, user.id);

  return (
    <div className="flex flex-col w-full min-h-screen pt-24 px-5 md:px-10 pb-10">
      <h1 className="text-2xl font-semibold text-brand mb-2">Email Sync</h1>
      <p className="text-sm text-gray-500 mb-6">
        Connect your email to automatically detect job application updates and recruiter outreach.
      </p>
      <EmailSync
        connection={connection}
        guide={<GmailSetupGuide />}
        history={<ScanHistory items={history} />}
      />
    </div>
  );
}
