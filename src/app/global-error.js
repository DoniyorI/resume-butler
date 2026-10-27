"use client";

import "./globals.css";
import ErrorState from "@/components/shared/ErrorState";

// Replaces the root layout when the layout itself fails, so it renders its own <html>
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body className="bg-white">
        <ErrorState error={error} reset={reset} />
      </body>
    </html>
  );
}
