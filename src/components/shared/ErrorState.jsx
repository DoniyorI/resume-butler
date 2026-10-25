"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Shared body for error.js boundaries: logs the error and offers a retry
export default function ErrorState({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-gray-600">Please try again. If it keeps happening, reload the page.</p>
      <Button onClick={reset} className="bg-brand hover:bg-brand/90">
        Try again
      </Button>
    </div>
  );
}
