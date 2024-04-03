import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import EmblaCarousel from "@/components/Carousel";

export default function Login() {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      
      <div className="flex w-full lg:w-6/12 items-center justify-center py-12">
        <div className="mx-auto w-[350px] space-y-6">
          {/* Title and introduction text */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Login</h1>
          </div>
          {/* Form and its elements */}
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="info@resumebutler.com"
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
              <Input id="password" type="password" required />
            </div>
            <Button type="submit" className="w-full">
              Login
            </Button>
            <Button variant="outline" className="w-full">
              <Image
                src="/image/google-logo.png"
                className="mr-2"
                alt="Google logo"
                width={25}
                height={25}
              />
              <span>Login with Google</span>
            </Button>
          </form>
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
