import { saveBlob } from "@/features/resumes/hooks/useResumeDownload";

export function downloadRecoveryCopy(content, title = "resume") {
  const name = String(title).replace(/[\\/:*?"<>|\r\n]/g, "-").slice(0, 150) || "resume";
  saveBlob(new Blob([JSON.stringify(content, null, 2)], { type: "application/json" }), `${name}-recovery.json`);
}
