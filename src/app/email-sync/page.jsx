"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Mail,
  Loader2,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";

export default function EmailSyncPage() {
  const { user, loading } = useAuth({ redirect: true });

  const [connection, setConnection] = useState(null);
  const [loadingConnection, setLoadingConnection] = useState(true);

  // Form state
  const [emailAddress, setEmailAddress] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [imapHost, setImapHost] = useState("imap.gmail.com");
  const [imapPort, setImapPort] = useState(993);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState(null);

  // Scan history
  const [scanHistory, setScanHistory] = useState([]);

  useEffect(() => {
    if (!user) return;
    fetchConnection();
    fetchScanHistory();
  }, [user]);

  const fetchConnection = async () => {
    try {
      const res = await fetch("/api/email-settings");
      const data = await res.json();
      if (data.connection) {
        setConnection(data.connection);
        setEmailAddress(data.connection.email_address);
        setImapHost(data.connection.imap_host);
        setImapPort(data.connection.imap_port);
      }
    } catch (err) {
      console.error("Error fetching connection:", err);
    } finally {
      setLoadingConnection(false);
    }
  };

  const fetchScanHistory = async () => {
    // Fetch recent processed emails from supabase client
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data } = await supabase
      .from("processed_emails")
      .select("*")
      .eq("user_id", user?.id)
      .order("processed_at", { ascending: false })
      .limit(50);
    setScanHistory(data || []);
  };

  const handleSaveConnection = async () => {
    if (!emailAddress || !appPassword) {
      toast("Please fill in your email and app password");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/email-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_address: emailAddress,
          app_password: appPassword,
          imap_host: imapHost,
          imap_port: imapPort,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConnection(data.connection);
      setAppPassword("");
      toast("Email connected successfully");
    } catch (err) {
      toast(err.message || "Failed to save email connection");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect your email? This won't delete any applications already tracked.")) return;
    try {
      const res = await fetch("/api/email-settings", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect");
      setConnection(null);
      setEmailAddress("");
      setAppPassword("");
      toast("Email disconnected");
    } catch (err) {
      toast(err.message);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    setScanResults(null);
    try {
      const res = await fetch("/api/scan-emails", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setScanResults(data);
      fetchScanHistory();
      if (data.new_applications > 0 || data.status_updates > 0) {
        toast(`Found ${data.new_applications} new applications and ${data.status_updates} status updates`);
      } else {
        toast("Scan complete - no new updates found");
      }
    } catch (err) {
      toast(err.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  if (loading || loadingConnection) {
    return (
      <div className="flex flex-col w-full min-h-screen pt-32 px-5 md:pt-24 md:px-10">
        <h1 className="text-2xl font-semibold text-[#559F87]">Email Sync</h1>
        <p className="text-gray-400 mt-4">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen pt-24 px-5 md:px-10 pb-10">
      <h1 className="text-2xl font-semibold text-[#559F87] mb-2">Email Sync</h1>
      <p className="text-sm text-gray-500 mb-6">
        Connect your email to automatically detect job application updates and recruiter outreach.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Connection settings */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail size={18} /> Email Connection
              </CardTitle>
              <CardDescription>
                {connection
                  ? `Connected: ${connection.email_address}`
                  : "Connect your email account via IMAP"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {connection ? (
                // Connected state
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <CheckCircle2 size={18} className="text-green-600" />
                    <div>
                      <p className="text-sm font-medium">{connection.email_address}</p>
                      <p className="text-xs text-gray-500">
                        {connection.imap_host}:{connection.imap_port}
                        {connection.last_scan_at && (
                          <> &middot; Last scan: {new Date(connection.last_scan_at).toLocaleString()}</>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleScan} disabled={scanning} className="flex-1">
                      {scanning ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning...</>
                      ) : (
                        <><RefreshCw size={14} className="mr-2" /> Scan Now</>
                      )}
                    </Button>
                    <Button variant="outline" onClick={handleDisconnect} className="text-red-600">
                      <Trash2 size={14} className="mr-1" /> Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                // Setup form
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@gmail.com"
                      value={emailAddress}
                      onChange={(e) => setEmailAddress(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">App Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Your Gmail App Password"
                        value={appPassword}
                        onChange={(e) => setAppPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="host">IMAP Host</Label>
                      <Input
                        id="host"
                        value={imapHost}
                        onChange={(e) => setImapHost(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="port">IMAP Port</Label>
                      <Input
                        id="port"
                        type="number"
                        value={imapPort}
                        onChange={(e) => setImapPort(parseInt(e.target.value) || 993)}
                      />
                    </div>
                  </div>

                  <Button onClick={handleSaveConnection} disabled={saving} className="w-full">
                    {saving ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting...</>
                    ) : (
                      "Connect Email"
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gmail setup guide */}
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
        </div>

        {/* Right column: Scan results + history */}
        <div className="space-y-4">
          {/* Latest scan results */}
          {scanResults && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Scan Results</CardTitle>
                <CardDescription>
                  Scanned {scanResults.emails_scanned} emails, found {scanResults.job_emails_found} job-related
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 bg-green-50 rounded">
                    <div className="text-xl font-bold text-green-700">{scanResults.new_applications}</div>
                    <div className="text-xs text-gray-500">New Apps</div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded">
                    <div className="text-xl font-bold text-blue-700">{scanResults.status_updates}</div>
                    <div className="text-xs text-gray-500">Updates</div>
                  </div>
                  <div className="text-center p-2 bg-teal-50 rounded">
                    <div className="text-xl font-bold text-teal-700">{scanResults.reached_out}</div>
                    <div className="text-xs text-gray-500">Reached Out</div>
                  </div>
                </div>

                {scanResults.details && scanResults.details.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {scanResults.details.map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{d.company} &mdash; {d.position}</p>
                          <p className="text-gray-400 truncate">{d.subject}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <Badge variant={d.status.toLowerCase()}>{d.status}</Badge>
                          <span className="text-gray-400">
                            {d.action === "created" ? "New" : d.action === "updated" ? "Updated" : "Skipped"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Scan history */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scan History</CardTitle>
              <CardDescription>
                {scanHistory.length} processed emails
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scanHistory.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  No scans yet. Connect your email and hit &quot;Scan Now&quot; to get started.
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {scanHistory.map((item) => {
                    const cls = item.classification || {};
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 border rounded text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.email_subject || "No subject"}</p>
                          <p className="text-gray-400 truncate">{item.email_from}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          {cls.is_job_related !== false && cls.status && (
                            <Badge variant={cls.status.toLowerCase()}>{cls.status}</Badge>
                          )}
                          {item.action_taken === "created" && (
                            <span className="text-green-600">New</span>
                          )}
                          {item.action_taken === "updated" && (
                            <span className="text-blue-600">Updated</span>
                          )}
                          {item.action_taken === "skipped" && (
                            <span className="text-gray-400">Skipped</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
