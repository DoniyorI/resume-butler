import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import EmblaCarousel from "@/components/Carousel";

export default function Register() {
  return (
    <div className="w-full flex min-h-screen">
      <div className="w-full lg:w-1/2 flex items-center justify-center p-12">
        <div className="mx-auto w-[350px]">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold">Sign Up</h1>
          </div>
          {/* Form and elements */}
          <form className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="info@resumebutler.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input id="confirm-password" type="password" required />
            </div>
            <Button type="submit" className="w-full">
              Sign up
            </Button>
            <Button variant="outline" className="w-full">
              <Image
                src="/image/google-logo.png"
                className="mr-2"
                alt="Google logo"
                width={25}
                height={25}
              />
              <span>Sign up with Google</span>
            </Button>
          </form>
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
