"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { parseInput, runAction } from "@/server/actionResult";
import { HttpError } from "@/server/http";
import { profileSchema } from "@/features/profile/schema";

export async function updateProfile(input) {
  return runAction("updateProfile", async () => {
    const { supabase, user } = await requireUser();
    const profile = parseInput(profileSchema, input);

    const { data, error } = await supabase
      .from("profiles")
      .update({
        first_name: profile.firstName,
        last_name: profile.lastName,
        phone: profile.phone,
        location: profile.location,
        linkedin: profile.linkedin,
        github: profile.github,
        portfolio: profile.portfolio,
        other_links: profile.otherLinks,
      })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new HttpError(404, "Profile not found.");

    revalidatePath("/profile");
    return null;
  });
}
