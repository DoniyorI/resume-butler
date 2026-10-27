"use client";
import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "@/features/auth/actions";

import Link from "next/link";
import Image from "next/image";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddApplicationDialog from "@/features/applications/AddApplication";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/applications", label: "Applications" },
  { href: "/documents", label: "Documents" },
  { href: "/profile", label: "Profile & CV" },
  { href: "/email-sync", label: "Email Sync" },
];

const NAV_LINK_CLASS =
  "block py-2 px-3 text-gray-900 rounded hover:bg-gray-100 lg:hover:bg-transparent lg:hover:text-green-800 lg:p-0 lg:dark:hover:text-green-400 dark:text-white dark:hover:bg-gray-700 dark:hover:text-white lg:dark:hover:bg-transparent dark:border-gray-700";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen(!menuOpen);
  const pathname = usePathname();

  // The nav stays mounted across pages, so close the mobile menu on every
  // navigation (also covers links outside the menu, like the logo)
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <nav className="bg-white dark:bg-gray-900 fixed w-full z-20 top-0 start-0 border-b border-gray-200 dark:border-gray-600">
      <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
        <Link
          href="/"
          aria-label="Resume Butler home"
          className="flex items-center space-x-3 rtl:space-x-reverse"
        >
          <Image src="/image/Logo.svg" alt="Logo" width="0" height="0" className="w-8 h-auto" />
          {/* The bar must stay one row (73px) so pages start below it: the name is
              hidden on phones, and the links collapse into the menu below lg */}
          <span className="hidden sm:inline self-center text-md font-medium whitespace-nowrap dark:text-white">
            Resume Butler
          </span>
        </Link>
        <div className="flex lg:order-2 space-x-3 lg:space-x-0 rtl:space-x-reverse">
          <div className="flex space-x-2">
            <AddApplicationDialog />
            {/* Signs out on the server, which clears the session cookies and goes to /login */}
            <form action={signOut}>
              <Button
                type="submit"
                variant="outline"
                aria-label="Sign out"
                className="bg-red-100 hover:bg-red-300 focus:ring-4 focus:outline-none focus:ring-blue-300  rounded-lg text-sm px-4 py-2 text-center"
              >
                <LogOut size={14} strokeWidth={2.25} className="text-black" />
              </Button>
            </form>
          </div>

          <Button
            variant="outline"
            onClick={toggleMenu}
            aria-expanded={menuOpen}
            aria-controls="navbar-sticky"
            className="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-500 rounded-lg lg:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
          >
            <span className="sr-only">Open main menu</span>
            <svg
              className="w-5 h-5"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 17 14"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M1 1h15M1 7h15M1 13h15"
              />
            </svg>
          </Button>
        </div>

        <div
          className={`items-center justify-between ${
            menuOpen ? "block" : "hidden"
          } w-full lg:flex lg:w-auto lg:order-1`}
          id="navbar-sticky"
        >
          <ul className="flex flex-col p-4 lg:p-0 mt-4 font-normal border border-gray-100 rounded-lg lg:space-x-6 rtl:space-x-reverse lg:flex-row lg:mt-0 lg:border-0  dark:bg-gray-800 lg:dark:bg-gray-900 dark:border-gray-700">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className={NAV_LINK_CLASS} onClick={() => setMenuOpen(false)}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
