"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, Loader2, Mail, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { disconnectEmail, saveEmailConnection } from "@/features/email-sync/actions";
import LocalDateTime from "@/components/shared/LocalDateTime";
import AutoSyncToggle from "@/features/email-sync/AutoSyncToggle";
import ScanOptions from "@/features/email-sync/ScanOptions";

const DEFAULT_HOST = "imap.gmail.com";
const DEFAULT_PORT = 993;

function ConnectedState({ connection, scanning, onScan, onDisconnect, scanOptions, onScanOptionsChange }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
        <CheckCircle2 size={18} className="text-green-600" />
        <div>
          <p className="text-sm font-medium">{connection.emailAddress}</p>
          <p className="text-xs text-gray-500">
            {connection.imapHost}:{connection.imapPort}
            {connection.lastScanAt && (
              <>
                {" "}
                &middot; Last scan: <LocalDateTime value={connection.lastScanAt} />
              </>
            )}
          </p>
        </div>
      </div>

      <div className="rounded-lg border p-3">
        <AutoSyncToggle connection={connection} />
      </div>

      <ScanOptions value={scanOptions} onChange={onScanOptionsChange} disabled={scanning} />

      <div className="flex gap-2">
        <Button onClick={onScan} disabled={scanning} className="flex-1">
          {scanning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Scanning...
            </>
          ) : (
            <>
              <RefreshCw size={14} className="mr-2" /> Scan Now
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onDisconnect} className="text-red-600">
          <Trash2 size={14} className="mr-1" /> Disconnect
        </Button>
      </div>
    </div>
  );
}

export default function ConnectionCard({ connection, scanning, onScan, scanOptions, onScanOptionsChange }) {
  const [emailAddress, setEmailAddress] = useState(connection?.emailAddress ?? "");
  const [appPassword, setAppPassword] = useState("");
  const [imapHost, setImapHost] = useState(connection?.imapHost ?? DEFAULT_HOST);
  const [imapPort, setImapPort] = useState(connection?.imapPort ?? DEFAULT_PORT);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, startSaving] = useTransition();

  const handleSave = () => {
    if (!emailAddress || !appPassword) {
      toast("Please fill in your email and app password");
      return;
    }
    startSaving(async () => {
      const result = await saveEmailConnection({ emailAddress, appPassword, imapHost, imapPort });
      if (!result.ok) {
        toast(result.error || "Failed to save email connection");
        return;
      }
      setAppPassword("");
      toast("Email connected successfully");
    });
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect your email? This won't delete any applications already tracked.")) return;
    const result = await disconnectEmail();
    if (!result.ok) {
      toast(result.error);
      return;
    }
    setEmailAddress("");
    setAppPassword("");
    toast("Email disconnected");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail size={18} /> Email Connection
        </CardTitle>
        <CardDescription>
          {connection ? `Connected: ${connection.emailAddress}` : "Connect your email account via IMAP"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connection ? (
          <ConnectedState
            connection={connection}
            scanning={scanning}
            onScan={onScan}
            scanOptions={scanOptions}
            onScanOptionsChange={onScanOptionsChange}
            onDisconnect={handleDisconnect}
          />
        ) : (
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
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
                <Input id="host" value={imapHost} onChange={(e) => setImapHost(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="port">IMAP Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={imapPort}
                  onChange={(e) => setImapPort(parseInt(e.target.value) || DEFAULT_PORT)}
                />
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connecting...
                </>
              ) : (
                "Connect Email"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
