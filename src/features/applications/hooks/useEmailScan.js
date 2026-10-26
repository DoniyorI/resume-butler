import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { postJson } from "@/lib/postJson";

// Quick scan from the applications table: the last 14 days with the default
// email types. Results become suggestions to review on the Email Sync page.
export function useEmailScan() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);

  const scan = async () => {
    setScanning(true);
    try {
      const data = await postJson("/api/scan-emails", {}, "Email scan failed");
      if (data.suggestions > 0) {
        toast(`Found ${data.suggestions} application updates to review`, {
          action: { label: "Review", onClick: () => router.push("/email-sync#review") },
        });
        router.refresh();
      } else {
        toast("No new application updates found in your email");
      }
    } catch (error) {
      if (error.message?.includes("No email connection")) {
        toast("Connect your email first in Email Sync settings", {
          action: { label: "Email Sync", onClick: () => router.push("/email-sync") },
        });
      } else {
        toast.error(error.message);
      }
    } finally {
      setScanning(false);
    }
  };

  return { scanning, scan };
}
