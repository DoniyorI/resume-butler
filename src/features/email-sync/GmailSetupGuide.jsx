import { Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GmailSetupGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield size={16} /> Gmail Setup Guide
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-gray-600 space-y-2">
        <p>For Gmail, you need an <strong>App Password</strong> (not your regular password):</p>
        <ol className="list-decimal ml-4 space-y-1">
          <li>Go to your Google Account settings</li>
          <li>Enable 2-Factor Authentication if not already on</li>
          <li>Search for &quot;App Passwords&quot; in account settings</li>
          <li>Create a new app password for &quot;Mail&quot;</li>
          <li>Use the 16-character password generated</li>
        </ol>
        <p className="text-gray-400 mt-2">
          For Outlook: use imap-mail.outlook.com port 993.
          For Yahoo: use imap.mail.yahoo.com port 993.
        </p>
      </CardContent>
    </Card>
  );
}
