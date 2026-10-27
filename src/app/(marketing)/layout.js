import Footer from "@/components/layout/Footer";
import MarketingHeader from "@/components/layout/MarketingHeader";

// Public pages, rendered once at build time: the header picks the app
// navigation or the visitor header in the browser
export default function MarketingLayout({ children }) {
  return (
    <div className="flex flex-col min-h-screen">
      <MarketingHeader />
      <main className="bg-white flex-1">{children}</main>
      <Footer />
    </div>
  );
}
