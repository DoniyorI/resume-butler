import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Header for signed-out visitors on public pages (about, contact). Same bar
// as the app's NavBar: 73px tall, translucent white.
export default function PublicHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-20 border-b bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-[72px] max-w-screen-2xl items-center justify-between gap-3 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/image/Logo.svg" alt="" width={32} height={36} className="h-8 w-auto" />
          <span className="text-[15px] font-semibold tracking-tight">Resume Butler</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="h-9">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm" className="h-9 bg-brand hover:bg-brand/90">
            <Link href="/register">Sign up</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
