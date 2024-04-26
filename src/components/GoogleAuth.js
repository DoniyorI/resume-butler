import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../lib/firebase/config";
import { Button } from "@/components/ui/button";
import Image from "next/image";

const GoogleAuthButton = ({ redirectPath = "/" }) => {
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      // Optional: Use the token, user, or credential as needed
      // const token = credential.accessToken;
      // const user = result.user;
      router.push(redirectPath);
    } catch (error) {
      // Handle Errors here.
      const errorCode = error.code;
      const errorMessage = error.message;
      // Optional: Handle the email, credential errors
      // const email = error.email;
      // const credential = GoogleAuthProvider.credentialFromError(error);
      console.error("Google sign in error", errorCode, errorMessage);
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
