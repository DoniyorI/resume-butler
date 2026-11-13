// Activity kinds, statuses and contact channels, shared by the server
// (validation) and the Next steps UI. The database enforces the same lists
// (migration 020).

export const ACTIVITY_KINDS = [
  "follow_up",
  "assessment",
  "recruiter_screen",
  "interview",
  "offer_deadline",
  "task",
];

export const ACTIVITY_KIND_LABELS = {
  follow_up: "Follow-up",
  assessment: "Assessment",
  recruiter_screen: "Recruiter screen",
  interview: "Interview",
  offer_deadline: "Offer deadline",
  task: "Task",
};

// The title the add form starts with for each kind (editable)
export const DEFAULT_TITLES = {
  follow_up: "Send a follow-up email",
  assessment: "Complete the assessment",
  recruiter_screen: "Recruiter screen",
  interview: "Interview",
  offer_deadline: "Decide on the offer",
  task: "",
};

// Kinds that usually happen at a set time, so the form offers a time field
export const TIMED_KINDS = ["interview", "recruiter_screen"];

export const ACTIVITY_STATUSES = ["open", "done", "cancelled"];

export const CONTACT_CHANNELS = ["email", "phone", "linkedin", "video", "in_person", "other"];

export const CONTACT_CHANNEL_LABELS = {
  email: "Email",
  phone: "Phone",
  linkedin: "LinkedIn",
  video: "Video call",
  in_person: "In person",
  other: "Other",
};

export const ACTIVITY_LIMIT = 2000;

export const SETUP_PENDING_MESSAGE = "Install migration 020 to use next steps.";

// "YYYY-MM-DD" for a Date in the viewer's own time zone
export function localDateKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Shift a "YYYY-MM-DD" key by whole days (calendar arithmetic, no time zone)
export function addDays(key, days) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

// Whole days from one "YYYY-MM-DD" key to another
export function daysBetween(fromKey, toKey) {
  const parse = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(toKey) - parse(fromKey)) / 86_400_000);
}

// True for a real "YYYY-MM-DD" day (rejects 2026-02-30)
export function isValidDateKey(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key || "");
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// True when Intl accepts the IANA zone name
export function isValidTimeZone(zone) {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

// The browser's (or server's) IANA zone
export const currentTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// The calendar day and clock time an instant shows in a zone:
// { date: "YYYY-MM-DD", time: "HH:mm" }
export function wallTimeInZone(instant, zone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/**
 * The ISO instant of a wall-clock date and time in a zone, or null when that
 * time doesn't exist there (the spring-forward gap). An ambiguous fall-back
 * time resolves to its first occurrence.
 */
export function zonedTimeToIso(date, time, zone) {
  if (!isValidDateKey(date) || !/^\d{2}:\d{2}$/.test(time || "") || !isValidTimeZone(zone)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (hh > 23 || mm > 59) return null;
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  const offsetAt = (instant) => {
    const wall = wallTimeInZone(instant, zone);
    const [wy, wm, wd] = wall.date.split("-").map(Number);
    const [wh, wmin] = wall.time.split(":").map(Number);
    return Date.UTC(wy, wm - 1, wd, wh, wmin) - instant;
  };
  // Try the offsets just before and after; keep the earliest that round-trips
  const candidates = [asUtc - offsetAt(asUtc - 86_400_000), asUtc - offsetAt(asUtc + 86_400_000), asUtc - offsetAt(asUtc)]
    .filter((instant) => {
      const wall = wallTimeInZone(instant, zone);
      return wall.date === date && wall.time === time;
    })
    .sort((a, b) => a - b);
  return candidates.length ? new Date(candidates[0]).toISOString() : null;
}

// The edit form's starting date, time and zone for a step: a timed step shows
// its time in the zone it was entered in, not the viewer's
export function activityTimeFields(activity, viewerZone = currentTimeZone()) {
  if (!activity?.startsAt) return { dueOn: activity?.dueOn || "", time: "", timeZone: viewerZone };
  const zone = isValidTimeZone(activity.timeZone) ? activity.timeZone : viewerZone;
  const wall = wallTimeInZone(activity.startsAt, zone);
  return { dueOn: activity.dueOn || wall.date, time: wall.time, timeZone: zone };
}

// The date, time and zone the form sends. Editing a timed step keeps the zone
// it was entered in; a new time (on a new or untimed step) uses the browser's.
export function stepTimeFields({ dueOn, time }, initial, browserZone = currentTimeZone()) {
  if (!time) return { dueOn: dueOn || null, time: null, timeZone: null };
  const keep = initial?.startsAt && isValidTimeZone(initial.timeZone);
  return { dueOn: dueOn || null, time, timeZone: keep ? initial.timeZone : browserZone };
}
