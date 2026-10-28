// Conservative posting identity, shared by server matching and its fixtures.
// No redirects or network requests: a page cannot nominate another posting ID.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATFORM_HOSTS = {
  "www.linkedin.com": "linkedin",
  "job-boards.greenhouse.io": "greenhouse",
  "boards.greenhouse.io": "greenhouse",
  "jobs.lever.co": "lever",
  "jobs.ashbyhq.com": "ashby",
};
const TRACKING = /^(utm_.+|trk|trackingId|gh_src|lever-source)$/i;

export function normalizePostingIdentity({ url = "", platform, postingId } = {}) {
  if (typeof url !== "string" || url.length > 2000) throw new Error("Invalid posting URL");
  if (platform != null && (typeof platform !== "string" || platform.length > 40)) throw new Error("Invalid posting platform");
  if (postingId != null && (typeof postingId !== "string" || postingId.length > 200)) throw new Error("Invalid posting ID");
  const result = { platform: null, namespace: null, postingId: null, urlKey: "" };
  if (!url.trim()) {
    if (postingId) throw new Error("A posting ID requires its URL");
    return result;
  }
  let parsed;
  try { parsed = new URL(url.trim()); } catch { throw new Error("Invalid posting URL"); }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("Invalid posting URL");
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) if (TRACKING.test(key)) parsed.searchParams.delete(key);
  result.urlKey = parsed.href;
  const site = !parsed.port && PLATFORM_HOSTS[parsed.hostname];
  const parts = parsed.pathname.split("/").filter(Boolean);
  let namespace, id;
  if (site === "linkedin" && parts[0] === "jobs") {
    id = parts[1] === "view" ? parts[2]?.match(/(?:^|-)(\d+)$/)?.[1] : parsed.searchParams.get("currentJobId");
    if (/^\d+$/.test(id || "")) namespace = "global";
  } else if (site === "greenhouse") {
    if (parts[0] === "embed") {
      namespace = parsed.searchParams.get("for");
      id = parsed.searchParams.get("token");
    } else if (parts[1] === "jobs") {
      namespace = parts[0]; id = parts[2];
    }
    if (!/^\d+$/.test(id || "")) namespace = null;
  } else if ((site === "lever" || site === "ashby") && UUID.test(parts[1] || "")) {
    namespace = parts[0]; id = parts[1].toLowerCase();
  }
  if (namespace && /^[a-zA-Z0-9_-]{1,200}$/.test(namespace) && id.length <= 200) {
    result.platform = site; result.namespace = namespace; result.postingId = id;
    result.urlKey = site === "linkedin" ? `https://www.linkedin.com/jobs/view/${id}/`
      : site === "greenhouse" ? `https://job-boards.greenhouse.io/${namespace}/jobs/${id}`
      : `https://${parsed.hostname}/${namespace}/${id}`;
  }
  if (platform && platform !== result.platform || postingId && postingId !== result.postingId) {
    throw new Error("The posting details do not match its URL");
  }
  return result;
}

export function samePostingIdentity(left, right) {
  return Boolean(left.platform && right.platform && left.namespace && right.namespace && left.postingId && right.postingId)
    && left.platform === right.platform && left.namespace === right.namespace && left.postingId === right.postingId;
}
