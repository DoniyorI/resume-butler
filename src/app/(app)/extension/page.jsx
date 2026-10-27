import { redirect } from "next/navigation";
import { requirePageUser } from "@/server/auth";
import ConnectExtension from "@/features/extension/ConnectExtension";
import { listExtensionTokens } from "@/features/extension/data";

export const metadata = { title: "Browser extension" };

// Manage connected browsers. Connecting happens on /extension/connect.
export default async function ExtensionPage({ searchParams }) {
  // Older extension builds open /extension?connect=1
  if (searchParams?.connect === "1") redirect("/extension/connect");
  const { supabase, user } = await requirePageUser();
  const tokens = await listExtensionTokens(supabase, user.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-10 pt-[85px] md:px-6">
      <div>
        <h1 className="text-xl font-semibold">Browser extension</h1>
        <p className="text-sm text-muted-foreground">Track applications automatically as you apply.</p>
      </div>
      <ConnectExtension tokens={tokens} />
    </div>
  );
}
