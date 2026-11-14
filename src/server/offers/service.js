import "server-only";
import { HttpError } from "@/server/http";
import { isValidDateKey } from "@/features/activities/kinds";
import {
  createActivity,
  isSetupPending,
  listActivities,
  setActivityStatus,
  updateActivity,
} from "@/server/activities/service";

// Job offers (migration 022): one record per application with its terms and
// the decision. The decide-by date is not a column: it is the open
// "offer_deadline" step in application_activities, so it also shows in Next
// steps and on the dashboard. Every query is scoped by user_id. Until the
// migration is applied, reads return { offer: null, setupPending: true } and
// writes a 503.

const TABLE = "application_offers";
const COLUMNS =
  "id,application_id,base_amount,base_period,currency,bonus,equity,benefits,start_date,received_on,decision,decided_on,notes,created_at,updated_at";
const SUGGESTION_LIMIT = 500;
const DEADLINE_KIND = "offer_deadline";
const DEADLINE_TITLE = "Decide on offer";

export const OFFERS_SETUP_MESSAGE = "Offers need database migration 022.";
export const DECISIONS = ["pending", "accepted", "declined"];

function check(error) {
  if (!error) return;
  if (isSetupPending(error)) throw new HttpError(503, OFFERS_SETUP_MESSAGE);
  if (error.code === "23503") throw new HttpError(404, "That application is no longer available.");
  throw error;
}

export function toOffer(row) {
  return {
    id: row.id,
    applicationId: row.application_id,
    baseAmount: row.base_amount ?? null,
    basePeriod: row.base_period || "year",
    currency: row.currency || "USD",
    bonus: row.bonus || "",
    equity: row.equity || "",
    benefits: row.benefits || "",
    startDate: row.start_date || null,
    receivedOn: row.received_on || null,
    decision: row.decision || "pending",
    decidedOn: row.decided_on || null,
    notes: row.notes || "",
    updatedAt: row.updated_at || null,
  };
}

async function assertOwnsApplication(supabase, userId, applicationId) {
  const { data, error } = await supabase
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "That application is no longer available.");
}

// The application's open offer-deadline steps, earliest date first (undated last)
async function openDeadlines(supabase, userId, applicationId) {
  const { items, setupPending } = await listActivities(supabase, userId, { applicationId });
  const open = items
    .filter((item) => item.kind === DEADLINE_KIND && item.status === "open")
    .sort((a, b) => (a.dueOn || "9999-12-31").localeCompare(b.dueOn || "9999-12-31"));
  return { open, setupPending };
}

/** { offer, decideBy, deadlineAvailable, setupPending }; never throws for a missing table. */
export async function getOffer(supabase, userId, applicationId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("application_id", applicationId)
    .maybeSingle();
  if (isSetupPending(error)) {
    return { offer: null, decideBy: null, deadlineAvailable: false, setupPending: true };
  }
  if (error) throw error;

  let decideBy = null;
  let deadlineAvailable = true;
  try {
    const deadlines = await openDeadlines(supabase, userId, applicationId);
    deadlineAvailable = !deadlines.setupPending;
    decideBy = deadlines.open.find((step) => step.dueOn)?.dueOn || null;
  } catch (failure) {
    console.warn("Could not load the offer deadline:", failure.message);
    deadlineAvailable = false;
  }
  return { offer: data ? toOffer(data) : null, decideBy, deadlineAvailable, setupPending: false };
}

// Create or reschedule the open decide-by step. The activities table being
// missing is not an error: the date is simply not kept.
async function setDecideBy(supabase, userId, applicationId, decideBy) {
  const { open, setupPending } = await openDeadlines(supabase, userId, applicationId);
  if (setupPending) return;
  const current = open.find((step) => step.dueOn) || open[0];
  if (current?.dueOn === decideBy) return;
  if (current) {
    await updateActivity(supabase, userId, current.id, {
      kind: current.kind,
      title: current.title,
      dueOn: decideBy,
      notes: current.notes,
      contactName: current.contactName,
      contactChannel: current.contactChannel,
      link: current.link,
    });
    return;
  }
  await createActivity(supabase, userId, {
    applicationId,
    kind: DEADLINE_KIND,
    title: DEADLINE_TITLE,
    dueOn: decideBy,
  });
}

/**
 * Save the offer's terms (never the decision). `decideBy` ("YYYY-MM-DD", or ""
 * or null to leave the step alone) goes to the offer-deadline step after the
 * offer is written; if that fails the offer is kept and `deadlineError` is set.
 */
export async function saveOffer(supabase, userId, applicationId, input) {
  await assertOwnsApplication(supabase, userId, applicationId);
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        application_id: applicationId,
        base_amount: input.baseAmount ?? null,
        base_period: input.basePeriod,
        currency: input.currency,
        bonus: input.bonus ?? "",
        equity: input.equity ?? "",
        benefits: input.benefits ?? "",
        start_date: input.startDate || null,
        received_on: input.receivedOn || null,
        notes: input.notes ?? "",
      },
      { onConflict: "application_id" }
    )
    .select(COLUMNS)
    .single();
  check(error);

  const result = { offer: toOffer(data) };
  if (input.decideBy) {
    try {
      await setDecideBy(supabase, userId, applicationId, input.decideBy);
    } catch (failure) {
      console.error("saveOffer deadline:", failure);
      result.deadlineError = true;
    }
  }
  return result;
}

/**
 * Accept, decline or set back to pending. A decision needs its date; pending
 * clears it. Accepting or declining completes the open decide-by steps, and
 * declining with `withdraw` moves the application to Withdrew.
 */
export async function decideOffer(supabase, userId, applicationId, { decision, decidedOn = null, withdraw = false }) {
  if (!DECISIONS.includes(decision)) throw new HttpError(400, "Unknown decision");
  const decided = decision !== "pending";
  if (decided && !isValidDateKey(decidedOn)) throw new HttpError(400, "Enter the date you decided");
  await assertOwnsApplication(supabase, userId, applicationId);

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      { user_id: userId, application_id: applicationId, decision, decided_on: decided ? decidedOn : null },
      { onConflict: "application_id" }
    )
    .select(COLUMNS)
    .single();
  check(error);

  const result = { offer: toOffer(data) };
  if (decided) {
    try {
      const { open } = await openDeadlines(supabase, userId, applicationId);
      for (const step of open) await setActivityStatus(supabase, userId, step.id, "done");
    } catch (failure) {
      console.error("decideOffer deadline:", failure);
      result.deadlineError = true;
    }
  }
  if (decision === "declined" && withdraw === true) {
    // The same update the status menu makes; the database trigger logs the history
    const { error: statusError } = await supabase
      .from("applications")
      .update({ status: "Withdrew" })
      .eq("id", applicationId)
      .eq("user_id", userId);
    if (statusError) {
      console.error("decideOffer withdraw:", statusError);
      result.statusError = true;
    }
  }
  return result;
}

export async function deleteOffer(supabase, userId, applicationId) {
  const { error } = await supabase.from(TABLE).delete().eq("application_id", applicationId).eq("user_id", userId);
  check(error);
  return { applicationId };
}

/** Map of application id -> decision for the given ids; empty before migration 022. */
export async function listOfferDecisions(supabase, userId, applicationIds) {
  const decisions = new Map();
  if (!applicationIds?.length) return decisions;
  const { data, error } = await supabase
    .from(TABLE)
    .select("application_id,decision")
    .eq("user_id", userId)
    .in("application_id", applicationIds);
  if (isSetupPending(error)) return decisions;
  if (error) throw error;
  for (const row of data) decisions.set(row.application_id, row.decision);
  return decisions;
}

/** What suggestNextSteps needs: [{ applicationId, decision, decidedOn }], at most 500. */
export async function listOffersForSuggestions(supabase, userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("application_id,decision,decided_on")
    .eq("user_id", userId)
    .limit(SUGGESTION_LIMIT);
  if (isSetupPending(error)) return [];
  if (error) throw error;
  return data.map((row) => ({
    applicationId: row.application_id,
    decision: row.decision,
    decidedOn: row.decided_on || null,
  }));
}
