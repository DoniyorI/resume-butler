import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#FCFFFD] p-2 dark:bg-gray-800">
      <div className="w-full mx-auto max-w-screen-xl p-4 md:flex md:items-center md:justify-between">
        <span className="text-sm text-[#188665] sm:text-center dark:text-gray-400">
          © 2024{" "}
          <Link href="/" class="hover:underline">
            Resume Butler™
          </Link>
          . All Rights Reserved.
        </span>
        <ul className="flex flex-wrap items-center mt-3 text-sm font-medium text-[#188665] dark:text-gray-400 sm:mt-0">
          <li>
            <Link href="/about" class="hover:underline me-4 md:me-6">
              About
            </Link>
          </li>
          <li>
            <Link href="https://github.com/DoniyorI" class="hover:underline me-4 md:me-6">
              Github
            </Link>
          </li>
          
          <li>
            <Link href="/contact" class="hover:underline">
              Contact Us
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
