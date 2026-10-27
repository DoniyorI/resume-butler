import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// Header for signed-out visitors on public pages (about, contact)
export default function PublicHeader() {
  return (
    <nav className="bg-white fixed w-full z-20 top-0 start-0 border-b border-gray-200">
      <div className="max-w-screen-xl flex items-center justify-between mx-auto p-4">
        <Link href="/" className="flex items-center space-x-3">
          <Image src="/image/Logo.svg" alt="Logo" width="0" height="0" className="w-8 h-auto" />
          <span className="self-center text-md font-medium whitespace-nowrap">Resume Butler</span>
        </Link>
        <div className="flex space-x-2">
          <Button asChild variant="outline">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild className="bg-brand hover:bg-brand/90">
            <Link href="/register">Sign up</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
