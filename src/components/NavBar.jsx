"use client";
import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MdSettings, MdLogout } from "react-icons/md";
import { useRouter, usePathname } from "next/navigation";
import ToggleButton from "./LogoutButton";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  const [isCollapsed, setIsCollapsed] = useState(false);
  const toggleNavbar = () => setIsCollapsed(!isCollapsed);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  return (
    <>
      <div
        className={`h-screen flex flex-col justify-between px-4 py-6 bg-[#E0F6EF] max-w-[215px] transition-all duration-300 ease-in-out sticky top-0 left-0 z-10 ${
          isCollapsed ? "w-[70px]" : "w-[215px]"
        }`}
      >
        <div className="flex flex-col space-y-2 p-2">
          <Link href="/" className="flex items-center space-x-2">
            <Image src={`/image/Logo.svg`} alt="Logo" width={40} height={40} />
            {!isCollapsed && (
              <span className="transition-opacity duration-300 ease-in-out opacity-100">
                Resume Butler
              </span>
            )}
            {isCollapsed && (
              <span className="transition-opacity duration-300 ease-in-out opacity-0">
                Resume Butler
              </span>
            )}
          </Link>
          <div className="flex-1 space-y-6 pt-10 overflow-y-auto">
            <Link href="/" className="flex items-center space-x-2">
              <Image src={`/image/Home.svg`} alt="Home" width={20} height={20} />
              {!isCollapsed && (
                <span className="transition-opacity duration-300 ease-in-out opacity-100">
                  Home
                </span>
              )}
              {isCollapsed && (
                <span className="transition-opacity duration-300 ease-in-out opacity-0">
                  Home
                </span>
              )}
            </Link>
            <Link href="/profile" className="flex items-center space-x-2">
              <Image src={`/image/Profile.svg`} alt="profile" width={20} height={20} />
              {!isCollapsed && (
                <span className="transition-opacity duration-300 ease-in-out opacity-100">
                  Profile
                </span>
              )}
              {isCollapsed && (
                <span className="transition-opacity duration-300 ease-in-out opacity-0">
                  Profile
                </span>
              )}
            </Link>
            <Link href="/applications" className="flex items-center space-x-2">
              <Image src={`/image/Applications.svg`} alt="Applications" width={20} height={20} />
              {!isCollapsed && (
                <span className="transition-opacity duration-300 ease-in-out opacity-100">
                  Application
                </span>
              )}
              {isCollapsed && (
                <span className="transition-opacity duration-300 ease-in-out opacity-0">
                  Application
                </span>
              )}
            </Link>
            <Link href="/resumes" className="flex items-center space-x-2">
              <Image src={`/image/Resume.svg`} alt="Resumes" width={20} height={20} />
              {!isCollapsed && (
                <span className="transition-opacity duration-300 ease-in-out opacity-100">
                  Resumes
                </span>
              )}
              {isCollapsed && (
                <span className="transition-opacity duration-300 ease-in-out opacity-0">
                  Resumes
                </span>
              )}
            </Link>
            <Link href="/coverletters" className="flex items-center space-x-2">
              <Image src={`/image/CoverLetter.svg`} alt="Cover Letter" width={20} height={20} />
              {!isCollapsed && (
                <span className="transition-opacity duration-300 ease-in-out opacity-100">
                  Cover Letters
                </span>
              )}
              {isCollapsed && (
                <span className="transition-opacity duration-300 ease-in-out opacity-0">
                  Cover Letters
                </span>
              )}
            </Link>
            <Link href="/cv" className="flex items-center space-x-2">
              <Image src={`/image/CV.svg`} alt="CV" width={20} height={20} />
              {!isCollapsed && (
                <span className="transition-opacity duration-300 ease-in-out opacity-100">
                  CV
                </span>
              )}
              {isCollapsed && (
                <span className="transition-opacity duration-300 ease-in-out opacity-0">
                  CV
                </span>
              )}
            </Link>
          </div>
          <div className="flex pt-10">
            <ToggleButton
              isCollapsed={isCollapsed}
              toggleNavbar={toggleNavbar}
            />
          </div>
        </div>
        <div className="p-2">
          <div className="flex flex-col space-y-2">
            <Link href="/setting" className="flex items-center space-x-2">
              <MdSettings size={20} />
              {!isCollapsed && (
                <span className="transition-opacity duration-300 ease-in-out opacity-100">
                  Settings
                </span>
              )}
              {isCollapsed && (
                <span className="transition-opacity duration-300 ease-in-out opacity-0">
                  Settings
                </span>
              )}
            </Link>
            <Link
              href="/login"
              onClick={handleLogout}
              className="flex items-center space-x-2"
            >
              <MdLogout />
              {!isCollapsed && (
                <span className="transition-opacity duration-300 ease-in-out opacity-100">
                  Logout
                </span>
              )}
              {isCollapsed && (
                <span className="transition-opacity duration-300 ease-in-out opacity-0">
                  Logout
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
