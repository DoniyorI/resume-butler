"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { parseInput, runAction } from "@/server/actionResult";
import { isValidDateKey } from "@/features/activities/kinds";
import { decideOffer, deleteOffer, saveOffer } from "@/server/offers/service";

// The offer shows on the application page, in the applications table and in
// the dashboard's suggestions
function refresh(applicationId) {
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/applications");
  revalidatePath("/");
}

const applicationId = z.string().uuid("Unknown application");
const date = z
  .union([z.string().refine(isValidDateKey, "That date doesn't exist. Pick a real calendar date."), z.literal(""), z.null()])
  .optional()
  .transform((value) => value || null);
const text = (max, label) =>
  z.string().max(max, `Keep ${label} under ${max.toLocaleString("en-US")} characters`).default("");

const saveInput = z.object({
  applicationId,
  baseAmount: z
    .union([z.number().int("Use a whole number for pay").min(0, "Pay can't be negative").max(100_000_000, "That pay looks too high"), z.null()])
    .optional()
    .transform((value) => value ?? null),
  basePeriod: z.enum(["hour", "day", "week", "month", "year"], { errorMap: () => ({ message: "Pick a pay period" }) }),
  currency: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
    z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code such as USD")
  ),
  bonus: text(500, "the bonus"),
  equity: text(500, "the equity"),
  benefits: text(1000, "the benefits"),
  startDate: date,
  receivedOn: date,
  decideBy: date,
  notes: text(5000, "notes"),
});

const decideInput = z.object({
  applicationId,
  decision: z.enum(["pending", "accepted", "declined"], { errorMap: () => ({ message: "Unknown decision" }) }),
  decidedOn: date,
  withdraw: z.boolean().optional().default(false),
});

export async function saveOfferAction(input) {
  return runAction("Save offer", async () => {
    const { supabase, user } = await requireUser();
    const { applicationId: id, ...values } = parseInput(saveInput, input);
    const result = await saveOffer(supabase, user.id, id, values);
    refresh(id);
    return result;
  });
}

export async function decideOfferAction(input) {
  return runAction("Decide offer", async () => {
    const { supabase, user } = await requireUser();
    const { applicationId: id, ...values } = parseInput(decideInput, input);
    const result = await decideOffer(supabase, user.id, id, values);
    refresh(id);
    return result;
  });
}

export async function deleteOfferAction(id) {
  return runAction("Delete offer", async () => {
    const { supabase, user } = await requireUser();
    const target = parseInput(applicationId, id);
    const result = await deleteOffer(supabase, user.id, target);
    refresh(target);
    return result;
  });
}
