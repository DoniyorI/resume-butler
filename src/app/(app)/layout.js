import Navbar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer";
import { requirePageUser } from "@/server/auth";

export const metadata = {
  robots: { index: false, follow: false },
};

// Everything in (app) requires a signed-in user. The middleware already
// redirects signed-out visitors; this server check is the backstop.
export default async function AppLayout({ children }) {
  await requirePageUser();

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="bg-white flex-1">{children}</main>
      <Footer />
    </div>
  );
}
