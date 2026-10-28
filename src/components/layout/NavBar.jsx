"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Puzzle, UserRound, X } from "lucide-react";
import { signOut } from "@/features/auth/actions";
import AddApplicationDialog from "@/features/applications/AddApplication";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Profile & CV lives in the account menu
const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/applications", label: "Applications" },
  { href: "/documents", label: "Documents" },
  { href: "/email-sync", label: "Inbox" },
];

// The current section: "/" only on the dashboard, the rest by prefix
const isActive = (pathname, href) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

// "doniyor.ismatilloev@gmail.com" -> "DI"
function initials(email) {
  const name = (email || "").split("@")[0];
  const parts = name.split(/[._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")).toUpperCase() || "?";
}

function AccountMenu({ email }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand ring-offset-2 transition-colors hover:bg-brand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {email ? initials(email) : <UserRound className="h-4 w-4" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {email && (
          <>
            <DropdownMenuLabel className="font-normal">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="truncate text-sm font-medium">{email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound className="mr-2 h-4 w-4" /> Profile & CV
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/extension">
            <Puzzle className="mr-2 h-4 w-4" /> Browser extension
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Signs out on the server, which clears the session cookies and goes to /login */}
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full text-red-600 focus:text-red-700">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The signed-in app's header. It stays 73px tall at every width: pages and
 * the editors are laid out below it (pt-[85px], top-[73px]). Links show in
 * the bar from md up, in a menu below that. `email` is the signed-in account,
 * shown in the account menu.
 */
export default function Navbar({ email }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // The nav stays mounted across pages, so close the menu on every navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="fixed inset-x-0 top-0 z-20 border-b bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-[72px] max-w-screen-2xl items-center gap-3 px-4 md:px-6">
        <Link href="/" aria-label="Resume Butler home" className="flex shrink-0 items-center gap-2.5">
          <Image src="/image/Logo.svg" alt="" width={32} height={36} className="h-8 w-auto" />
          <span className="hidden text-[15px] font-semibold tracking-tight sm:inline md:hidden lg:inline">
            Resume Butler
          </span>
        </Link>

        <nav aria-label="Main" className="ml-2 hidden min-w-0 md:block lg:ml-6">
          <ul className="flex items-center gap-0.5">
            {NAV_LINKS.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-gray-100 font-medium text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <AddApplicationDialog />
          <AccountMenu email={email} />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Phones: the same links, below the bar */}
      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t bg-white px-4 pb-4 pt-2 shadow-sm md:hidden"
        >
          <ul className="flex flex-col gap-0.5">
            {NAV_LINKS.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-3 py-2.5 text-sm",
                      active ? "bg-gray-100 font-medium text-gray-900" : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
