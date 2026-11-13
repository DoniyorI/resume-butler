"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { runAction } from "@/server/actionResult";
import { enforceRateLimit } from "@/server/rateLimit";
import {
  addCompany,
  checkCompany,
  dismissPosting,
  refreshStale,
  removeCompany,
  savePosting,
  updateKeywords,
} from "@/server/watchlist/service";

// The server functions validate input and scope every query by user_id

const refresh = () => revalidatePath("/watchlist");

export async function watchCompany(input) {
  return runAction("Watch company", async () => {
    const { supabase, user } = await requireUser();
    await enforceRateLimit(supabase, "watchlist-add"); // before any request to the board
    const result = await addCompany(supabase, user.id, input);
    refresh();
    return result;
  });
}

export async function updateWatchKeywords(companyId, keywords) {
  return runAction("Update watch keywords", async () => {
    const { supabase, user } = await requireUser();
    const company = await updateKeywords(supabase, user.id, companyId, keywords);
    refresh();
    return company;
  });
}

export async function unwatchCompany(companyId) {
  return runAction("Unwatch company", async () => {
    const { supabase, user } = await requireUser();
    const result = await removeCompany(supabase, user.id, companyId);
    refresh();
    return result;
  });
}

export async function checkCompanyNow(companyId) {
  return runAction("Check company now", async () => {
    const { supabase, user } = await requireUser();
    await enforceRateLimit(supabase, "watchlist-check");
    const result = await checkCompany(supabase, user.id, companyId);
    refresh();
    return result;
  });
}

export async function refreshStaleBoards() {
  return runAction("Refresh watched boards", async () => {
    const { supabase, user } = await requireUser();
    await enforceRateLimit(supabase, "watchlist-check");
    const result = await refreshStale(supabase, user.id);
    refresh();
    return result;
  });
}

export async function dismissWatchedPosting(postingId) {
  return runAction("Dismiss watched posting", async () => {
    const { supabase, user } = await requireUser();
    const result = await dismissPosting(supabase, user.id, postingId);
    refresh();
    return result;
  });
}

export async function saveWatchedPosting(postingId) {
  return runAction("Save watched posting", async () => {
    const { supabase, user } = await requireUser();
    const jobId = await savePosting(supabase, user.id, postingId);
    refresh();
    revalidatePath("/saved-jobs");
    return { jobId };
  });
}
