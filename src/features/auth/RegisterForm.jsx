"use client";
import { toast } from "sonner";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import dynamic from "next/dynamic";
const EmblaCarousel = dynamic(() => import("@/features/auth/AuthCarousel"), { ssr: false });

import { signUp } from "@/features/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import GoogleAuthButton from "@/features/auth/GoogleAuthButton";

export default function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setPending(true);
    const result = await signUp({ email, password });
    setPending(false);
    if (!result.ok) return toast.error(result.error);
    // With email confirmation on, there is no session until the link is clicked
    if (result.data.confirmEmail) return toast.success("Check your email to confirm your account.");
    router.replace("/profile");
    router.refresh();
  };

  return (
    <div className="w-full flex min-h-screen">
      <div className="w-full lg:w-1/2 flex items-center justify-center p-12">
        <div className="absolute left-5 top-5 flex items-center space-x-2">
          <Image src="/image/Logo.svg" alt="Logo" width="0" height="0" className="w-8 h-auto" />
          <span className="self-center text-md font-medium  whitespace-nowrap dark:text-white">
            Resume Butler
          </span>
        </div>
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
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">At least {MIN_PASSWORD_LENGTH} characters.</p>
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
            <Button type="submit" className="w-full" disabled={pending}>
              Sign up
            </Button>
          </form>

          <GoogleAuthButton redirectPath="/profile" />

          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
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
                title: "Tailored to Stand Out",
                description: "Elevate Your Application process with AI and Secure Your Next Job Interview!",
              },
              {
                animation: "salesman",
                alt: "Image 1",
                type: "animation",
                title: "Tracking for Success",
                description: "Seamlessly integrate your strengths into every job application.",
              },
              {
                animation: "design",
                alt: "Image 3",
                width: 192,
                height: 108,
                type: "animation",
                title: "Stay Organized with Ease",
                description:
                  "Streamline your job search by tracking every application seamlessly. Stay on top of every opportunity.",
              },
              {
                animation: "3",
                alt: "Image 4",
                width: 192,
                height: 108,
                type: "animation",
                title: "Precision in Every Application",
                description: "Every job application is unique. Let us tailor your resume to fit perfectly.",
              },
            ]}
            options={{ loop: true }}
          />
        </div>
      </div>
    </div>
  );
}
