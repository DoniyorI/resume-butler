import { requirePageUser } from "@/server/auth";
import ConnectFlow from "@/features/extension/ConnectFlow";

export const metadata = { title: "Connect the extension" };

// The extension opens this right after it's installed. Signed-out visitors are
// sent to sign in by the middleware and come back here (?next=) to connect.
export default async function ConnectExtensionPage() {
  const { user } = await requirePageUser();
  return <ConnectFlow email={user.email || ""} />;
}
