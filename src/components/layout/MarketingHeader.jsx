"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import PublicHeader from "@/components/layout/PublicHeader";

// The app navigation is only downloaded for signed-in visitors
const Navbar = dynamic(() => import("@/components/layout/NavBar"));

// Supabase keeps the session in "sb-<project>-auth-token" cookies (split into
// .0, .1 when large). Only a hint for which header to show: these pages are
// public, and every app page checks the user on the server.
const hasSessionCookie = () => /(?:^|;\s*)sb-[^=]+-auth-token(?:\.\d+)?=/.test(document.cookie);

// Public pages (about, contact) stay static: signed-in visitors get the app
// navigation once the page has loaded, everyone else the public header
export default function MarketingHeader() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(hasSessionCookie()), []);
  return signedIn ? <Navbar /> : <PublicHeader />;
}
