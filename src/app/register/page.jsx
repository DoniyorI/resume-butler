"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import EmblaCarousel from "@/components/Carousel";

import { auth } from "../firebase/config";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";



export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const router = useRouter();

  const handleGoogleSignUp = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      // This gives you a Google Access Token. You can use it to access the Google API.
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential.accessToken;
      // The signed-in user info.
      const user = result.user;
      // Redirect the user or do something with the user info
      console.log(user);
      router.push("/dashboard");
    } catch (error) {
      const errorCode = error.code;
      const errorMessage = error.message;
      const email = error.email;
      const credential = GoogleAuthProvider.credentialFromError(error);
      console.error("Google sign in error", errorCode, errorMessage);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/login"); // Redirect the user after successful registration, adjust as necessary
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="w-full flex min-h-screen">
      <div className="w-full lg:w-1/2 flex items-center justify-center p-12">
        <div className="mx-auto w-[350px]">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold">Sign Up</h1>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="info@resumebutler.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              Sign up
            </Button>
            
          </form>
          <Button 
          variant="outline"
              className="w-full"
              onClick={handleGoogleSignUp}>
              <Image
                src="/image/google-logo.png"
                alt="Google logo"
                width={25}
                height={25}
              />
              <span>Sign up with Google</span>
            </Button>
          <div className="mt-4 text-center text-sm">
            Don't have an account?{" "}
            <Link href="/login" className="underline">
              Login
            </Link>
          </div>
        </div>
      </div>
      <div className="hidden lg:flex w-1/2 bg-[#E7FEED] justify-center items-center">
        <div className="w-7/12">
          <EmblaCarousel
            slides={[
              { src: "/image/c1.png", alt: "Image 1", width: 192, height: 108 },
              { src: "/image/c1.png", alt: "Image 2", width: 192, height: 108 },
              { src: "/image/c1.png", alt: "Image 3", width: 192, height: 108 },
            ]}
            options={{ loop: true }}
          />
        </div>
      </div>
    </div>
  );
}
