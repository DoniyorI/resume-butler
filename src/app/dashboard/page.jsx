// import { useAuthStore } from "react-firebase-hooks/auth";
"use client";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  return (
    <div>
      {/* Correct event handler to onClick */}
      <Button onClick={handleLogout}>Logout</Button>
    </div>
  );
}
