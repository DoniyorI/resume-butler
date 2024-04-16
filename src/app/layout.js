import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/NavBar";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex">
          <Navbar className="" />
          <div className="flex-1">{children}</div>
          <Toaster />
        </div>
      </body>
    </html>
  );
}
