"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { runAction } from "@/server/actionResult";
import {
  createActivity,
  deleteActivity,
  setActivityStatus,
  updateActivity,
} from "@/server/activities/service";

// Next steps show on the application page and in the dashboard's Today card
function refresh(applicationId) {
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/");
}

// The server functions validate input (zod) and scope every query by user_id

export async function createActivityAction(input) {
  return runAction("Create activity", async () => {
    const { supabase, user } = await requireUser();
    const activity = await createActivity(supabase, user.id, input);
    refresh(activity.applicationId);
    return activity;
  });
}

export async function updateActivityAction(id, input) {
  return runAction("Update activity", async () => {
    const { supabase, user } = await requireUser();
    const activity = await updateActivity(supabase, user.id, id, input);
    refresh(activity.applicationId);
    return activity;
  });
}

export async function setActivityStatusAction(id, status) {
  return runAction("Set activity status", async () => {
    const { supabase, user } = await requireUser();
    const activity = await setActivityStatus(supabase, user.id, id, status);
    refresh(activity.applicationId);
    return activity;
  });
}

export async function deleteActivityAction(id) {
  return runAction("Delete activity", async () => {
    const { supabase, user } = await requireUser();
    const deleted = await deleteActivity(supabase, user.id, id);
    refresh(deleted.applicationId);
    return deleted;
  });
}
