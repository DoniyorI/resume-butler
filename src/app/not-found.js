import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <p className="text-sm font-semibold text-brand">404</p>
      <h1 className="text-2xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="text-gray-600">It may have been moved or deleted.</p>
      <Button asChild className="bg-brand hover:bg-brand/90">
        <Link href="/">Back to your dashboard</Link>
      </Button>
    </main>
  );
}
