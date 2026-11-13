import "server-only";
import { HttpError } from "@/server/http";
import { cleanText, decodeEntities, htmlToText } from "@/server/watchlist/htmlText";

// Public job boards on Greenhouse, Lever and Ashby: one GET returns the whole
// board. Everything that comes back is untrusted third-party content: it is
// size-capped, coerced to strings, cut to length, and never trusted for URLs
// (links are rebuilt from the board token and the posting id).

const TOKEN = /^[A-Za-z0-9_-]{1,100}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_ID = /^\d{1,20}$/;
const PLATFORMS = ["greenhouse", "lever", "ashby"];
const LINK_HOSTS = {
  "boards.greenhouse.io": "greenhouse",
  "job-boards.greenhouse.io": "greenhouse",
  "jobs.lever.co": "lever",
  "jobs.ashbyhq.com": "ashby",
};
const ACCEPTED =
  "Use a link like https://boards.greenhouse.io/company, https://jobs.lever.co/company or https://jobs.ashbyhq.com/company, or write greenhouse:company, lever:company or ashby:company.";

export const MAX_BODY_BYTES = 15 * 1024 * 1024;
export const MAX_POSTINGS = 2000;
const TIMEOUT_MS = 15_000;
const NOT_FOUND = "That job board was not found. Check the link.";
const UNREADABLE = "Could not read that job board right now.";

/** { platform, token } from a board link or "platform:token", or a 400 HttpError. */
export function parseBoardLink(input) {
  const fail = () => new HttpError(400, `That is not a job board link we can read. ${ACCEPTED}`);
  if (typeof input !== "string") throw fail();
  const text = input.trim();
  if (!text || text.length > 300 || /[\\\s]/.test(text)) throw fail();

  const short = /^([a-z]+):([^/\s]*)$/i.exec(text);
  if (short && PLATFORMS.includes(short[1].toLowerCase())) {
    const name = short[1].toLowerCase();
    if (!TOKEN.test(short[2]) || (name === "greenhouse" && short[2].toLowerCase() === "embed")) throw fail();
    return { platform: short[1].toLowerCase(), token: short[2] };
  }

  // The raw path is checked before URL parsing resolves any "../" away
  const raw = /^https?:\/\/([^/?#\\@]+)((?:\/[^?#\\]*)?)/i.exec(text);
  if (!raw) throw fail();
  const platform = LINK_HOSTS[raw[1].toLowerCase()];
  if (!platform) throw fail();
  const segments = raw[2].split("/").slice(1).filter((part, i, all) => part !== "" || i < all.length - 1);
  if (segments.some((part) => part === "." || part === ".." || part.includes("%"))) throw fail();
  const token = segments[0] || "";
  // "embed" is Greenhouse's embed script path, not a company
  if (!TOKEN.test(token) || (platform === "greenhouse" && token.toLowerCase() === "embed")) throw fail();
  return { platform, token };
}

// Read at most `limit` bytes of the body; anything bigger fails
async function readCapped(response, limit) {
  const declared = Number(response.headers?.get?.("content-length") || 0);
  if (declared > limit) throw new Error("too large");
  if (!response.body?.getReader) throw new Error("no body");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      throw new Error("too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Multi-line text, and one line for titles and locations; both free of control
// characters and lone surrogates and cut without splitting a pair
const text = (value, max) => cleanText(cleanText(value, max * 2).trim(), max);
const line = (value, max) => cleanText(cleanText(value, max * 2).replace(/\s+/g, " ").trim(), max).trimEnd();

/**
 * The canonical public link of a posting, built only from the platform, the
 * board token and the vendor's posting id; null when the id doesn't fit what
 * that platform's links need. The only way a link is ever made for a posting.
 */
export function postingUrl(platform, token, postingId) {
  if (typeof token !== "string" || !TOKEN.test(token) || typeof postingId !== "string") return null;
  if (platform === "greenhouse") return NUMERIC_ID.test(postingId) ? `https://job-boards.greenhouse.io/${token}/jobs/${postingId}` : null;
  if (platform === "lever") return UUID.test(postingId) ? `https://jobs.lever.co/${token}/${postingId.toLowerCase()}` : null;
  if (platform === "ashby") return UUID.test(postingId) ? `https://jobs.ashbyhq.com/${token}/${postingId.toLowerCase()}` : null;
  return null;
}

function dateOf(value, now) {
  const time = typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isFinite(time) || time < Date.UTC(2000, 0, 1) || time > now + 86_400_000) return null;
  return new Date(time).toISOString();
}

function workplaceOf(value, isRemote) {
  const key = typeof value === "string" ? value.toLowerCase().replace(/[^a-z]/g, "") : "";
  if (key === "remote") return "remote";
  if (key === "hybrid") return "hybrid";
  if (key === "onsite") return "onsite";
  return isRemote === true ? "remote" : "";
}

const EMPLOYMENT = { fulltime: "Full-time", parttime: "Part-time", contract: "Contract", intern: "Internship", temporary: "Temporary" };

const asArray = (value) => (Array.isArray(value) ? value : []);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const ADAPTERS = {
  greenhouse: {
    url: (token) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`,
    list: (body) => (isObject(body) && Array.isArray(body.jobs) ? body.jobs : null),
    name: (jobs) => line(jobs.find((job) => isObject(job) && typeof job.company_name === "string")?.company_name, 200),
    posting(job, token, now) {
      const id = typeof job.id === "number" || typeof job.id === "string" ? String(job.id) : "";
      if (!NUMERIC_ID.test(id)) return null;
      return {
        postingId: id,
        title: line(job.title, 300),
        location: line(job.location?.name, 300),
        url: postingUrl("greenhouse", token, id),
        // The content is HTML-escaped HTML: decode once, then strip the tags
        description: htmlToText(decodeEntities(typeof job.content === "string" ? job.content : "")),
        workplaceType: "",
        employmentType: "",
        postedAt: dateOf(job.first_published, now) || dateOf(job.updated_at, now),
      };
    },
  },
  lever: {
    url: (token) => `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`,
    list: (body) => (Array.isArray(body) ? body : null),
    name: () => "",
    posting(job, token, now) {
      const id = typeof job.id === "string" ? job.id.toLowerCase() : "";
      if (!UUID.test(id)) return null;
      const sections = [text(job.descriptionPlain, 20000)];
      for (const list of asArray(job.lists)) {
        if (!isObject(list)) continue;
        const heading = line(list.text, 200);
        const items = htmlToText(typeof list.content === "string" ? list.content : "");
        sections.push([heading, items].filter(Boolean).join("\n"));
      }
      sections.push(text(job.additionalPlain, 20000));
      const categories = isObject(job.categories) ? job.categories : {};
      return {
        postingId: id,
        title: line(job.text, 300),
        location: line(categories.location, 300),
        url: postingUrl("lever", token, id),
        description: cleanText(sections.filter(Boolean).join("\n\n"), 20000).trimEnd(),
        workplaceType: workplaceOf(job.workplaceType),
        employmentType: line(categories.commitment, 40),
        postedAt: dateOf(job.createdAt, now),
      };
    },
  },
  ashby: {
    url: (token) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}`,
    list: (body) => (isObject(body) && Array.isArray(body.jobs) ? body.jobs : null),
    name: () => "",
    posting(job, token, now) {
      const id = typeof job.id === "string" ? job.id.toLowerCase() : "";
      if (!UUID.test(id) || job.isListed === false) return null;
      const plain = text(job.descriptionPlain, 20000);
      return {
        postingId: id,
        title: line(job.title, 300),
        location: line(job.location, 300),
        url: postingUrl("ashby", token, id),
        description: plain || htmlToText(typeof job.descriptionHtml === "string" ? job.descriptionHtml : ""),
        workplaceType: workplaceOf(job.workplaceType, job.isRemote),
        employmentType: EMPLOYMENT[String(job.employmentType || "").toLowerCase()] || line(job.employmentType, 40),
        postedAt: dateOf(job.publishedAt, now),
      };
    },
  },
};

/**
 * Read one public board. Returns { name, total, postings }: `name` is the
 * company name when the board says it (otherwise ""), `total` the number of
 * postings on the board, `postings` the first 2,000 mapped to our shape.
 * Throws HttpError 404 for an unknown board and 502 for anything else.
 * `fetch` and `now` are injectable for tests.
 */
export async function fetchBoard({ platform, token }, { fetch: fetchImpl = globalThis.fetch, now = Date.now() } = {}) {
  const adapter = ADAPTERS[platform];
  if (!adapter || typeof token !== "string" || !TOKEN.test(token)) throw new HttpError(400, ACCEPTED);

  let response;
  let body;
  try {
    response = await fetchImpl(adapter.url(token), {
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json", "user-agent": "ResumeButler/1.0" },
    });
    if (response.status === 404) {
      await response.body?.cancel?.().catch(() => {});
      throw new HttpError(404, NOT_FOUND);
    }
    if (!response.ok) {
      await response.body?.cancel?.().catch(() => {});
      throw new Error(`status ${response.status}`);
    }
    body = JSON.parse(await readCapped(response, MAX_BODY_BYTES));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    // Only the kind of failure is logged, never anything the vendor sent
    console.error(`Job board read failed (${platform}): ${response && !response.ok ? `status ${response.status}` : error?.name || "error"}`);
    throw new HttpError(502, UNREADABLE);
  }

  const jobs = adapter.list(body);
  if (!jobs) {
    console.error(`Job board read failed (${platform}): unexpected shape`);
    throw new HttpError(502, UNREADABLE);
  }
  const postings = [];
  const seen = new Set();
  for (const job of jobs.slice(0, MAX_POSTINGS)) {
    if (!isObject(job)) continue;
    const posting = adapter.posting(job, token, now);
    if (!posting || !posting.title || seen.has(posting.postingId)) continue;
    seen.add(posting.postingId);
    postings.push(posting);
  }
  return { name: adapter.name(jobs), total: jobs.length, postings };
}
