"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseInput, runAction } from "@/server/actionResult";
import { requireUser } from "@/server/auth";

const GOAL_MAX = 200;

const goalSchema = z
  .object({
    period: z.enum(["day", "week"], { errorMap: () => ({ message: "Pick daily or weekly" }) }),
    target: z.coerce
      .number()
      .int("Use a whole number")
      .min(1, "Aim for at least 1")
      .max(GOAL_MAX, `At most ${GOAL_MAX}`),
  })
  .nullable();

// Set the "apply to N jobs a day/week" goal, or clear it with null
export async function saveGoal(goal) {
  return runAction("Error saving goal", async () => {
    const { supabase, user } = await requireUser();
    const parsed = parseInput(goalSchema, goal);

    const { error } = await supabase
      .from("profiles")
      .update({ goal_period: parsed?.period ?? null, goal_target: parsed?.target ?? null })
      .eq("id", user.id);
    if (error) throw error;

    revalidatePath("/");
    return parsed;
  });
}
