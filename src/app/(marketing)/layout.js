import Navbar from "@/components/layout/NavBar";
import Footer from "@/components/layout/Footer";
import PublicHeader from "@/components/layout/PublicHeader";
import { createClient } from "@/lib/supabase/server";

// Public pages: signed-in users see the app navigation, visitors a simple header
export default async function MarketingLayout({ children }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col min-h-screen">
      {user ? <Navbar /> : <PublicHeader />}
      <main className="bg-white flex-1">{children}</main>
      <Footer />
    </div>
  );
}
