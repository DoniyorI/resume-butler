import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/NavBar";
import Footer from "@/components/Footer";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Resume Builder",
  description: "Elevate Your Application process with AI and Secure Your Next Job!",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex flex-col min-h-screen">
          <Navbar className="sticky top-0 w-full" />
          <div className="bg-white">{children}</div>
          <Footer className="bottom-0 w-full"/>
          <Toaster />
        </div>
      </body>
    </html>
  );
}
