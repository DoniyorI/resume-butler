import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// Runs POST /api/scan-emails and reloads the page data when anything changed
export function useEmailScan() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);

  const scan = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/scan-emails", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Email scan failed");

      if (data.new_applications > 0 || data.status_updates > 0) {
        toast(`Email scan: ${data.new_applications} new, ${data.status_updates} updated`);
        router.refresh();
      } else {
        toast("No new updates found in emails");
      }
    } catch (error) {
      if (error.message?.includes("No email connection")) {
        toast("Connect your email first in Email Sync settings");
      } else {
        toast(error.message || "Email scan failed");
      }
    } finally {
      setScanning(false);
    }
  };

  return { scanning, scan };
}
