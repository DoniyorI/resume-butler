// Signed-in browser check of "Connect Gmail with Google" on local servers, with disposable
// @example.test users deleted in `finally`. Never prints the password, keys or tokens.
//   - http://localhost:3000 (no Google keys): no Google button, /api/gmail/connect reports "not set up",
//     the app-password form and an existing IMAP connection still work.
//   - http://localhost:3001 (a local build started with placeholder GOOGLE_CLIENT_ID/SECRET): the button
//     leads to Google's consent URL with read-only scope, offline access and this origin's callback;
//     the state cookie is httpOnly and scoped to /api/gmail; a forged state and a denial store nothing;
//     signed out, the routes send you to sign in.
//   - With migration 023 applied (`post`): a stored Gmail connection shows as connected with Google,
//     a scan with an unusable token asks to reconnect (Google rejects the placeholder client), and
//     Disconnect removes the row.
// Google's consent page is never opened: the check stops at the redirect to accounts.google.com.
//
// NODE_PATH=/opt/homebrew/lib/node_modules node --use-system-ca --import ./tests/register.mjs scripts/qa-gmail-connect.mjs pre|post
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const MODE = process.argv[2];
if (!["pre", "post"].includes(MODE)) throw new Error("Pass pre or post (whether migration 023 is applied).");
const PLAIN = "http://localhost:3000", KEYED = "http://localhost:3001";
if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !== "tlmabncoijnuxymxohgu.supabase.co") throw new Error("This check is restricted to the named QA project.");

const { encryptSecret } = await import("@/server/crypto");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.QA_PLAYWRIGHT_MODULE || "playwright");

const run = randomBytes(5).toString("hex");
const email = `sync-qa-${run}-gmail@example.test`;
const password = `QA!${randomBytes(24).toString("base64url")}9a`;
const steps = {}, observed = {}, pageErrors = [];
const check = ({ data, error }) => { if (error) throw new Error(`${error.code || "DB"}: ${error.message}`); return data; };
async function step(name, fn) {
  try { await fn(); steps[name] = "pass"; }
  catch (error) { steps[name] = `fail: ${error.message.split("\n").slice(0, 3).join(" | ").slice(0, 400)}`; }
}

let browser = null, userId = null, cleanup = { ok: false };
try {
  userId = check(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sync_qa_run: run } })).user.id;
  browser = await chromium.launch({ channel: "chrome", headless: true });

  const signedIn = async (base) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on("pageerror", (error) => pageErrors.push(`${error.message} @ ${base}${new URL(page.url()).pathname}`));
    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 45000 });
    return { context, page };
  };
  const googleButton = (page) => page.getByRole("link", { name: "Connect Gmail with Google" });
  const notice = (page) => page.locator('p[role="status"]').innerText();

  // ---------- no Google keys ----------
  await step("plain-no-button", async () => {
    const { context, page } = await signedIn(PLAIN);
    try {
      await page.goto(`${PLAIN}/email-sync`, { waitUntil: "networkidle" });
      assert.equal(await googleButton(page).count(), 0, "no Google button without keys");
      assert.equal(await page.getByRole("button", { name: "Connect Email" }).count(), 1, "app-password form");
      await page.goto(`${PLAIN}/api/gmail/connect`, { waitUntil: "networkidle" });
      assert.equal(new URL(page.url()).search, "?gmail=unavailable");
      assert.match(await notice(page), /not set up on this server/);
    } finally { await context.close(); }
  });

  await step("plain-imap-connection-loads", async () => {
    check(await admin.from("email_connections").insert({ user_id: userId, email_address: `inbox-${run}@example.test`, app_password: encryptSecret("qa-not-a-real-password"), imap_host: "imap.gmail.com", imap_port: 993 }).select("id"));
    const { context, page } = await signedIn(PLAIN);
    try {
      await page.goto(`${PLAIN}/email-sync`, { waitUntil: "networkidle" });
      const card = (await page.locator("main, body").first().innerText()).replace(/\s+/g, " ");
      assert.ok(card.includes(`inbox-${run}@example.test`) && card.includes("imap.gmail.com:993"), "IMAP connection shown with its host");
      await page.goto(`${PLAIN}/`, { waitUntil: "networkidle" });
      assert.ok((await page.locator("body").innerText()).includes(`inbox-${run}@example.test`), "dashboard Inbox card");
    } finally { await context.close(); }
    check(await admin.from("email_connections").delete().eq("user_id", userId).select("id"));
  });

  // ---------- placeholder Google keys ----------
  await step("keyed-button-and-consent-url", async () => {
    const { context, page } = await signedIn(KEYED);
    try {
      await page.goto(`${KEYED}/email-sync`, { waitUntil: "networkidle" });
      assert.equal(await googleButton(page).count(), 1, "Google button with keys");
      assert.match((await page.locator("body").innerText()), /can never send, change or delete email/);
      assert.equal(await googleButton(page).getAttribute("href"), "/api/gmail/connect");
      // The browser's own request client (same cookies), stopping at the redirect so Google is never opened
      const toGoogle = async () => {
        const response = await page.request.get(`${KEYED}/api/gmail/connect`, { maxRedirects: 0 });
        assert.equal(response.status(), 307);
        return new URL(response.headers().location);
      };
      const consent = await toGoogle();
      assert.equal(consent.origin + consent.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
      assert.equal(consent.searchParams.get("scope"), "https://www.googleapis.com/auth/gmail.readonly");
      assert.equal(consent.searchParams.get("access_type"), "offline");
      assert.equal(consent.searchParams.get("redirect_uri"), `${KEYED}/api/gmail/callback`);
      const cookie = (await context.cookies(`${KEYED}/api/gmail/callback`)).find((c) => c.name === "rb_gmail_state");
      assert.ok(cookie && cookie.httpOnly && cookie.path === "/api/gmail", "httpOnly state cookie on /api/gmail");
      assert.equal(cookie.value.split(".")[0], consent.searchParams.get("state"));
      assert.equal(cookie.value.split(".")[1], userId);
      assert.equal((await context.cookies(`${KEYED}/email-sync`)).some((c) => c.name === "rb_gmail_state"), false, "cookie not sent to pages");
      const state = consent.searchParams.get("state");

      await page.goto(`${KEYED}/api/gmail/callback?state=forged&code=x`, { waitUntil: "networkidle" });
      assert.equal(new URL(page.url()).search, "?gmail=expired");
      assert.match(await notice(page), /expired or was started elsewhere/);
      // The forged callback cleared the cookie, so even the real state is now refused
      await page.goto(`${KEYED}/api/gmail/callback?state=${state}&error=access_denied`, { waitUntil: "networkidle" });
      assert.equal(new URL(page.url()).search, "?gmail=expired");

      // A fresh round trip, denied on Google's page
      const again = await toGoogle();
      await page.goto(`${KEYED}/api/gmail/callback?state=${again.searchParams.get("state")}&error=access_denied`, { waitUntil: "networkidle" });
      assert.equal(new URL(page.url()).search, "?gmail=denied");
      assert.match(await notice(page), /sign-in was cancelled/);
      assert.equal(check(await admin.from("email_connections").select("id").eq("user_id", userId)).length, 0, "nothing stored");
      await page.goto(`${KEYED}/email-sync?gmail=constructor`, { waitUntil: "networkidle" });
      assert.equal(await page.locator('p[role="status"]').count(), 0, "unknown outcomes show nothing");
    } finally { await context.close(); }
  });

  await step("signed-out-routes", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      for (const path of ["/api/gmail/connect", "/api/gmail/callback?state=x&code=y"]) {
        await page.goto(`${KEYED}${path}`, { waitUntil: "networkidle" });
        assert.equal(new URL(page.url()).pathname, "/login", path);
      }
    } finally { await context.close(); }
  });

  // ---------- a stored Gmail connection (needs migration 023) ----------
  if (MODE === "post") {
    await step("post-gmail-connection", async () => {
      check(await admin.from("email_connections").insert({ user_id: userId, provider: "gmail", email_address: `gmail-${run}@example.test`, app_password: null, oauth_refresh_token: encryptSecret("qa-not-a-real-refresh-token"), imap_host: "imap.gmail.com", imap_port: 993 }).select("id"));
      const bad = await admin.from("email_connections").update({ oauth_refresh_token: null }).eq("user_id", userId).select("id");
      assert.ok(bad.error, "a Gmail row without a token is refused by the check constraint");
      const { context, page } = await signedIn(KEYED);
      try {
        await page.goto(`${KEYED}/email-sync`, { waitUntil: "networkidle" });
        const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
        assert.ok(text.includes("Gmail, connected with Google (read-only)") && text.includes(`gmail-${run}@example.test`), "connected with Google");
        const scan = page.waitForResponse((r) => r.url().endsWith("/api/scan-emails"));
        await page.getByRole("button", { name: /Scan Now/ }).click();
        const response = await scan;
        observed.scanStatus = response.status();
        const body = await response.json();
        assert.equal(response.status(), 400);
        assert.match(body.error, /Reconnect Gmail/);
        assert.ok(!JSON.stringify(body).includes("qa-not-a-real"), "no token in the response");
        page.once("dialog", (dialog) => dialog.accept());
        await page.getByRole("button", { name: /Disconnect/ }).click();
        await page.waitForTimeout(2500);
        assert.equal(check(await admin.from("email_connections").select("id").eq("user_id", userId)).length, 0, "disconnected");
      } finally { await context.close(); }
    });
    await step("post-imap-still-saves", async () => {
      check(await admin.from("email_connections").insert({ user_id: userId, email_address: `inbox2-${run}@example.test`, app_password: encryptSecret("x"), imap_host: "imap.gmail.com", imap_port: 993 }).select("id"));
      const [row] = check(await admin.from("email_connections").select("provider").eq("user_id", userId));
      assert.equal(row.provider, "imap", "existing-style rows default to imap");
    });
  }
  steps["no-page-errors"] = pageErrors.length ? `fail: ${pageErrors.slice(0, 3).join(" | ")}` : "pass";
} catch (error) {
  steps.setup = `fail: ${error.message.slice(0, 300)}`;
} finally {
  if (browser) await browser.close().catch(() => {});
  try {
    if (userId) {
      await admin.from("email_connections").delete().eq("user_id", userId);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error(`deleteUser: ${error.message}`);
      const { data: got } = await admin.auth.admin.getUserById(userId);
      cleanup = got?.user ? { ok: false, left: "authUser" } : { ok: true };
    } else cleanup = { ok: true };
  } catch (error) {
    cleanup = { ok: false, error: error.message.slice(0, 200) };
  }
  // eslint-disable-next-line no-console -- the one JSON report
  console.log(JSON.stringify({ run, mode: MODE, steps, observed, pageErrors, cleanup }, null, 1));
  if (!cleanup.ok || Object.values(steps).some((v) => v !== "pass")) process.exitCode = 1;
}
