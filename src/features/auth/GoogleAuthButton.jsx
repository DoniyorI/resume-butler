"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import Image from "next/image";

const GoogleAuthButton = ({ redirectPath = "/" }) => {
  const router = useRouter();
  const supabase = createClient();

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${redirectPath}`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error("Google sign in error", error.message);
    }
  };

  return (
    <Button
      variant="outline"
      className="w-full space-x-2"
      onClick={handleGoogleSignIn}
    >
      <Image
        src="/image/google-logo.png"
        alt="Google logo"
        width={25}
        height={25}
      />
      <span>Sign up with Google</span>
    </Button>
  );
};

export default GoogleAuthButton;
