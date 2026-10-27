import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: {
    default: "Resume Butler",
    template: "%s | Resume Butler",
  },
  description: "Elevate your application process with AI and secure your next job.",
};

// Navigation and footer live in the route group layouts: (app), (auth), (marketing)
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
