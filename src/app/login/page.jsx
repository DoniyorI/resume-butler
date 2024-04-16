"use client";
import Link from "next/link";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import EmblaCarousel from "@/components/Carousel";

// import { useSignInWithEmailAndPassword } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase/config";
import { signInWithEmailAndPassword } from "firebase/auth";
// import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

import GoogleAuthButton from "@/components/GoogleAuth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/"); // Redirect the user after successful login, adjust as necessary
    } catch (error) {
      alert(error.message); // Inform the user in case of an error
    }
  };
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex w-full lg:w-6/12 items-center justify-center py-12">
        <div className="mx-auto w-[350px] space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Login</h1>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="info@resumebutler.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-sm underline">
                  Forgot your password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Login
            </Button>
          </form>
          <GoogleAuthButton redirectPath="/dashboard" />
          {/* Link to sign up */}
          <div className="text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="underline">
              Sign up
            </Link>
          </div>
        </div>
      </div>
      <div className="hidden lg:flex w-6/12 justify-center items-center bg-[#E7FEED]">
        <div className="w-7/12">
          <EmblaCarousel
            slides={[
              {
                src: "/image/c1.png",
                alt: "Image 1",
                width: 192,
                height: 108,
              },
              {
                src: "/image/c1.png",
                alt: "Image 2",
                width: 192,
                height: 108,
              },
              {
                src: "/image/c1.png",
                alt: "Image 3",
                width: 192,
                height: 108,
              },
            ]}
            options={{ loop: true }}
          />
        </div>
      </div>
    </div>
  );
}
