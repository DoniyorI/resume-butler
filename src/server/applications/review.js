import "server-only";
import { z } from "zod";
import { HttpError } from "@/server/http";

export const resolutionChoice = z.object({
  applicationId: z.string().uuid().nullable().default(null),
  createNew: z.boolean(),
}).refine(value => value.createNew !== Boolean(value.applicationId), "Choose an application or create a separate one");

export function resolutionResult(data, error) {
  if (["PGRST202", "42883"].includes(error?.code)) throw new HttpError(503, "Matching is being updated. Your item is still saved safely; try again shortly.");
  if (["P0002", "42501"].includes(error?.code)) throw new HttpError(404, "This item or application is no longer available. Refresh to see its current state.");
  if (error?.code === "55000") throw new HttpError(409, "This application changed. Refresh and review the current details before matching.");
  if (error) throw new Error(`Application matching failed (${error.code || "unknown"})`);
  const id = data?.application?.id || data;
  if (!z.string().uuid().safeParse(id).success) throw new Error("Invalid matching result");
  return { applicationId: id };
}
