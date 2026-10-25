"use client";

import ErrorState from "@/components/shared/ErrorState";

export default function AppError({ error, reset }) {
  return <ErrorState error={error} reset={reset} />;
}
