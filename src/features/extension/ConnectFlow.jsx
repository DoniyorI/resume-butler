"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Loader2, PuzzleIcon, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectExtension } from "@/features/extension/actions";
import { extensionStatus, handToExtension, waitForExtension } from "@/features/extension/handoff";

const SITES = "LinkedIn Easy Apply, Greenhouse, Lever and Ashby";

function Panel({ icon, title, children }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
        {icon}
      </div>
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="mt-2 max-w-sm space-y-4 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

/**
 * Connects the extension to the signed-in account without any clicks. The
 * extension opens this page right after it's installed (signed-out visitors
 * sign in first and come back here). `email` is the signed-in account's.
 */
export default function ConnectFlow({ email }) {
  // "checking" | "connecting" | "connected" | "already" | "missing" | "error"
  const [state, setState] = useState("checking");
  const [error, setError] = useState(null);

  const run = useCallback(async () => {
    setState("checking");
    setError(null);
    if (!(await waitForExtension())) return setState("missing");

    // Already connected to this account: nothing to do, and no new token
    const status = await extensionStatus();
    if (status?.connected && status.email?.toLowerCase() === email.toLowerCase()) return setState("already");

    setState("connecting");
    const result = await connectExtension();
    if (!result.ok) {
      setError(result.error);
      return setState("error");
    }
    if (await handToExtension(result.data.token)) setState("connected");
    else {
      setError("The extension didn't answer. Reload this page to try again.");
      setState("error");
    }
  }, [email]);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  return (
    <div className="flex min-h-[calc(100dvh-73px)] items-center justify-center px-4 pt-[73px]">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        {(state === "checking" || state === "connecting") && (
          <Panel icon={<Loader2 className="h-6 w-6 animate-spin" />} title="Connecting the extension">
            <p>Linking it to {email}.</p>
          </Panel>
        )}

        {(state === "connected" || state === "already") && (
          <Panel
            icon={<CheckCircle2 className="h-7 w-7" />}
            title={state === "connected" ? "You're all set" : "Already connected"}
          >
            <p>
              Applications you submit on {SITES} are added to your tracker automatically, with the job
              description. A small notice confirms each one, with an undo.
            </p>
            <p>You can close this tab.</p>
            <div className="flex justify-center gap-2 pt-1">
              <Button asChild size="sm">
                <Link href="/">Go to your dashboard</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/extension">Manage</Link>
              </Button>
            </div>
          </Panel>
        )}

        {state === "missing" && (
          <Panel icon={<PuzzleIcon className="h-6 w-6" />} title="Install the extension first">
            <p>
              We couldn&apos;t find the Resume Butler extension in this browser. Install it, and it will bring
              you back here to connect.
            </p>
            <div className="flex justify-center gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={run}>
                <RotateCw className="mr-2 h-3.5 w-3.5" /> Check again
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/extension">Connect manually</Link>
              </Button>
            </div>
          </Panel>
        )}

        {state === "error" && (
          <Panel icon={<RotateCw className="h-6 w-6" />} title="Couldn't connect">
            <p>{error}</p>
            <div className="flex justify-center gap-2 pt-1">
              <Button size="sm" onClick={run}>
                Try again
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/extension">Connect manually</Link>
              </Button>
            </div>
          </Panel>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 border-t pt-4 text-xs text-muted-foreground">
          <Image src="/image/Logo.svg" alt="" width={16} height={18} />
          Resume Butler for Chrome
        </div>
      </div>
    </div>
  );
}
