"use client";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

import Link from "next/link";
import Image from "next/image";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddApplicationDialog from "@/features/applications/AddApplication";

const NAV_LINKS = [
  { href: "/", label: "Applications" },
  { href: "/dash", label: "Dashboard" },
  { href: "/resumes", label: "Resumes" },
  { href: "/coverletters", label: "Cover Letters" },
  { href: "/profile", label: "Profile" },
  { href: "/cv", label: "Master CV" },
  { href: "/email-sync", label: "Email Sync" },
];

const NAV_LINK_CLASS =
  "block py-2 px-3 text-gray-900 rounded hover:bg-gray-100 md:hover:bg-transparent md:hover:text-green-800 md:p-0 md:dark:hover:text-green-400 dark:text-white dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent dark:border-gray-700";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen(!menuOpen);
  const supabase = createClient();

  const router = useRouter();
  const pathname = usePathname();

  // The nav stays mounted across pages, so close the mobile menu on every
  // navigation (also covers links outside the menu, like the logo)
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  return (
    <nav className="bg-white dark:bg-gray-900 fixed w-full z-20 top-0 start-0 border-b border-gray-200 dark:border-gray-600">
      <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
        <Link href="/" className="flex items-center space-x-3 rtl:space-x-reverse">
          <Image src="/image/Logo.svg" alt="Logo" width="0" height="0" className="w-8 h-auto" />
          <span className="self-center text-md font-medium whitespace-nowrap dark:text-white">
            Resume Butler
          </span>
        </Link>
        <div className="flex md:order-2 space-x-3 md:space-x-0 rtl:space-x-reverse">
          <div className="flex space-x-2">
            <AddApplicationDialog />
            <Button
              onClick={handleLogout}
              variant="outline"
              className="bg-red-100 hover:bg-red-300 focus:ring-4 focus:outline-none focus:ring-blue-300  rounded-lg text-sm px-4 py-2 text-center"
            >
              <LogOut size={14} strokeWidth={2.25} className="text-black" />
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={toggleMenu}
            aria-expanded={menuOpen}
            aria-controls="navbar-sticky"
            className="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-500 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
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
          } w-full md:flex md:w-auto md:order-1`}
          id="navbar-sticky"
        >
          <ul className="flex flex-col p-4 md:p-0 mt-4 font-normal border border-gray-100 rounded-lg md:space-x-8 rtl:space-x-reverse md:flex-row md:mt-0 md:border-0  dark:bg-gray-800 md:dark:bg-gray-900 dark:border-gray-700">
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
