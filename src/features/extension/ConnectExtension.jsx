"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Copy, Laptop, Loader2, PlugZap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import LocalDateTime from "@/components/shared/LocalDateTime";
import { connectExtension, revokeExtensionToken } from "@/features/extension/actions";

// Handing the token to the extension, without copy and paste. Two routes:
// 1. The extension's content script on this site (see docs/chrome-extension-plan.md,
//    "Connecting"): it marks <html data-resume-butler-extension>, and answers a
//    same-origin postMessage { source: APP_SOURCE, type: "connect", token } with
//    { source: EXTENSION_SOURCE, type: "connected", ok: true }.
// 2. externally_connectable, once the extension has a fixed ID (NEXT_PUBLIC_EXTENSION_ID).
const APP_SOURCE = "resume-butler-app";
const EXTENSION_SOURCE = "resume-butler-extension";
const HANDOFF_TIMEOUT_MS = 2000;
const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID;

function extensionInstalled() {
  return (
    typeof document !== "undefined" && document.documentElement.hasAttribute("data-resume-butler-extension")
  );
}

function viaContentScript(token) {
  return new Promise((resolve) => {
    if (!extensionInstalled()) return resolve(false);
    const timer = setTimeout(() => finish(false), HANDOFF_TIMEOUT_MS);
    function onMessage(event) {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.source === EXTENSION_SOURCE && event.data?.type === "connected")
        finish(event.data.ok === true);
    }
    function finish(ok) {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(ok);
    }
    window.addEventListener("message", onMessage);
    window.postMessage({ source: APP_SOURCE, type: "connect", token }, window.location.origin);
  });
}

function viaExternalMessage(token) {
  return new Promise((resolve) => {
    // eslint-disable-next-line no-undef
    const runtime = typeof chrome !== "undefined" ? chrome.runtime : undefined;
    if (!EXTENSION_ID || !runtime?.sendMessage) return resolve(false);
    try {
      runtime.sendMessage(EXTENSION_ID, { type: "resume-butler:connect", token }, (reply) => {
        resolve(!runtime.lastError && reply?.ok === true);
      });
    } catch {
      resolve(false);
    }
  });
}

// Resolves to true if the extension took the token
async function handToExtension(token) {
  return (await viaContentScript(token)) || (await viaExternalMessage(token));
}

function NewToken({ token, onDone }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
  };
  return (
    <div className="space-y-3 rounded-lg border border-brand/40 bg-brand/5 p-4">
      <p className="text-sm font-medium">Paste this into the extension to connect it</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border bg-background px-3 py-2 text-xs">
          {token}
        </code>
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        It&apos;s shown only once. Anyone with it can add applications to your tracker, so don&apos;t share
        it.
      </p>
      <Button size="sm" variant="ghost" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

/**
 * Connect the browser extension: creates a token (handed to the extension
 * directly when possible, or shown once to paste in), and lists connected
 * browsers with a way to disconnect each. `tokens` from features/extension/data.js.
 */
export default function ConnectExtension({ tokens, autoConnect = false }) {
  const [newToken, setNewToken] = useState(null);
  const [connected, setConnected] = useState(false);
  const [pending, startTransition] = useTransition();

  const connect = () =>
    startTransition(async () => {
      const result = await connectExtension();
      if (!result.ok) return toast.error(result.error);
      if (await handToExtension(result.data.token)) {
        setConnected(true);
        toast("The extension is connected");
      } else {
        // No extension answered: show the token once to paste in
        setNewToken(result.data.token);
      }
    });

  // The extension opens /extension?connect=1 right after it's installed
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoConnect || autoStarted.current) return;
    autoStarted.current = true;
    connect();
  });

  const revoke = (id) =>
    startTransition(async () => {
      const result = await revokeExtensionToken(id);
      if (!result.ok) return toast.error(result.error);
      toast("Browser disconnected");
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlugZap className="h-4 w-4 text-brand" /> Connect the extension
          </CardTitle>
          <CardDescription>
            When you apply on Greenhouse, Lever, Ashby and other job sites, the extension adds the application
            to your tracker with the job description, and email sync then keeps its status up to date. You can
            undo any addition right after it happens.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connected ? (
            <p className="flex items-center gap-2 text-sm font-medium text-brand">
              <Check className="h-4 w-4" /> Connected. You can close this tab.
            </p>
          ) : newToken ? (
            <NewToken token={newToken} onDone={() => setNewToken(null)} />
          ) : (
            <Button onClick={connect} disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect this browser
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected browsers</CardTitle>
          <CardDescription>Disconnecting one stops it from adding applications right away.</CardDescription>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">No browsers connected yet.</p>
          ) : (
            <ul className="divide-y">
              {tokens.map((token) => (
                <li key={token.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Laptop className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{token.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Connected <LocalDateTime value={token.createdAt} format="date" />
                        {token.lastUsedAt ? (
                          <>
                            , last used <LocalDateTime value={token.lastUsedAt} format="date" />
                          </>
                        ) : (
                          ", not used yet"
                        )}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => revoke(token.id)} disabled={pending}>
                    Disconnect
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
