"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import EmblaCarousel from "@/components/Carousel";

import { auth, db } from "@/lib/firebase/config";
import { doc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import GoogleAuthButton from "@/components/GoogleAuth";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      // Set up a new document in the 'users' collection with the user's UID
      await setDoc(doc(db, "users", user.uid), {
        email: user.email, // You can add more default fields here if needed
      });
      router.push("/profile"); // Redirect to the profile page
    } catch (error) {
      console.error("Error creating new user: ", error);
      if (error.code === "auth/email-already-in-use") {
        alert("This email is already in use by another account.");
      } else {
        alert("Failed to create account. Please try again later.");
      }
    }
  };

  return (
    <div className="w-full flex min-h-screen">
      <div className="w-full lg:w-1/2 flex items-center justify-center p-12">
        <div className="mx-auto w-[350px]">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold">Sign Up</h1>
          </div>
          <form className="space-y-4 mb-6" onSubmit={handleSubmit}>
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

          <GoogleAuthButton redirectPath="/login" />

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
              {
                src: "/image/c1.png",
                alt: "Image 2",
                width: 192,
                height: 108,
                type: "image",
              },
              {
                animation: "salesman",
                alt: "Image 1",
                type: "animation",
              },

              {
                animation: "design",
                alt: "Image 3",
                width: 192,
                height: 108,
                type: "animation",
              },
              {
                animation: "3",
                alt: "Image 4",
                width: 192,
                height: 108,
                type: "animation",
              },
            ]}
            options={{ loop: true }}
          />
        </div>
      </div>
    </div>
  );
}
