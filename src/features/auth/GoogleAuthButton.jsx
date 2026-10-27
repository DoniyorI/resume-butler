"use client";
import { toast } from "sonner";
import { startGoogleSignIn } from "@/features/auth/actions";
import { safeNextPath } from "@/lib/redirects";
import { Button } from "@/components/ui/button";
import Image from "next/image";

const GoogleAuthButton = ({ redirectPath = "/" }) => {
  const handleGoogleSignIn = async () => {
    // Return to the page the visitor was sent here from (?next=, e.g. the
    // extension's connect page), or to `redirectPath`
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"), redirectPath);
    const result = await startGoogleSignIn({ next });
    if (!result.ok) return toast.error(result.error);
    window.location.assign(result.data.url);
  };

  return (
    <Button variant="outline" className="w-full space-x-2" onClick={handleGoogleSignIn}>
      <Image src="/image/google-logo.png" alt="Google logo" width={25} height={25} />
      <span>Continue with Google</span>
    </Button>
  );
};

export default GoogleAuthButton;
