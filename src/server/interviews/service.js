import "server-only";
import { z } from "zod";
import { readResumeForEditing } from "@/features/resumes/resumeDocument";
import { listActivities } from "@/server/activities/service";
import { getSubmission } from "@/server/applications/submissionData";
import { assessFit } from "@/server/fit/assessFit";
import { loadMasterCv } from "@/server/resume/loadCv";
import {
  MIN_DESCRIPTION,
  buildInterviewPrep,
  chooseDescription,
  chooseSubmission,
  submissionResumeContent,
} from "@/server/interviews/prepare";

// Interview preparation for one application. Every query is scoped by user_id.
// Returns null when the application is not the user's.

const APPLICATION_COLUMNS = "id,company,role,status,job_description,resume_id";
const SUBMISSION_COLUMNS = "id,application_id,submitted_on,created_at,supersedes_id";

async function chooseRecord(supabase, userId, applicationId) {
  const { data, error } = await supabase
    .from("application_submissions")
    .select(SUBMISSION_COLUMNS)
    .eq("user_id", userId)
    .eq("application_id", applicationId)
    .limit(500);
  // Before migration 015 (or on any failure) the page falls back to the saved application
  if (error) {
    console.warn("Could not list submitted versions:", error.message);
    return null;
  }
  const chosen = chooseSubmission(data || []);
  return chosen ? getSubmission(supabase, userId, chosen.id).catch((failure) => {
    console.warn("Could not read the submitted version:", failure.message);
    return null;
  }) : null;
}

async function currentResumeContent(supabase, userId, resumeId) {
  if (!resumeId) return null;
  const { data, error } = await supabase
    .from("resumes")
    .select("content")
    .eq("id", resumeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.content || null;
}

export async function loadInterviewPrep(supabase, userId, applicationId, { now = new Date() } = {}) {
  if (!z.string().uuid().safeParse(applicationId).success) return null;
  const { data: row, error } = await supabase
    .from("applications")
    .select(APPLICATION_COLUMNS)
    .eq("id", applicationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;
  const application = {
    id: row.id,
    company: row.company || "",
    role: row.role || "",
    status: row.status || "",
    jobDescription: row.job_description || "",
    resumeId: row.resume_id || null,
  };

  const submission = await chooseRecord(supabase, userId, applicationId);

  // Before migration 020 (or when steps fail to load) there is simply no upcoming step
  const activities = await listActivities(supabase, userId, { applicationId })
    .then((result) => (result.setupPending ? null : result.items))
    .catch((failure) => {
      console.warn("Could not load next steps:", failure.message);
      return null;
    });

  let cv = null;
  let fit = null;
  const description = chooseDescription(application, submission);
  try {
    cv = await loadMasterCv(supabase, userId);
    if (description.length >= MIN_DESCRIPTION) {
      const content = submission ? submissionResumeContent(submission) : await currentResumeContent(supabase, userId, application.resumeId);
      const document = content ? readResumeForEditing(content) : null;
      fit = assessFit({
        jobDescription: description,
        cv,
        resumeContent: document && !document.readOnly ? document.content : null,
        today: now,
      });
    }
  } catch (failure) {
    console.warn("Could not assess fit for interview preparation:", failure.message);
    fit = null;
  }

  return buildInterviewPrep({ application, submission, fit, cv, activities, now });
}
