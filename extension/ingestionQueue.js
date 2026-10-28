// Every queue mutation shares one chain in the worker. Entries are retained
// until the server acknowledges their stable UUID, including review conflicts.
export function createIngestionQueue({ storage, uuid = () => crypto.randomUUID(), today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
} }) {
  let chain = Promise.resolve();
  const owned = (entry, account) => entry.version === 1 && entry.userId === account.userId && entry.origin === account.origin;
  const key = job => {
    // Board-local IDs are unique only inside their employer's namespace.
    let namespace = "";
    try {
      const url = new URL(job.url);
      namespace = url.origin + url.pathname + (url.searchParams.get("for") || "");
    } catch { namespace = job.company || ""; }
    return JSON.stringify([job.site || "", namespace, job.jobId || job.role || ""]);
  };
  const claimable = (entry, account) => (!entry.userId || entry.userId === account.userId)
    && (!entry.origin || entry.origin === account.origin)
    && (entry.version !== 1 || !entry.userId || !entry.origin);
  const read = async () => (await storage.get("queue")).queue || [];
  const transact = fn => {
    const result = chain.then(async () => { const rows = await read(); const value = fn(rows); await storage.set({ queue: rows }); return value; });
    chain = result.catch(() => {});
    return result;
  };
  const prepare = ({ userId, origin, job }) => {
    if (!userId || !origin) throw new Error("Connect your account before saving a submission");
    return { version: 1, eventId: uuid(), userId, origin, job: structuredClone(job), appliedDate: job.appliedDate || today(), state: "queued" };
  };
  return {
    captureSubmission: account => transact(rows => {
      const existing = rows.find(entry => owned(entry, account) && key(entry.job) === key(account.job));
      if (existing) return structuredClone(existing);
      if (rows.length >= 100) throw new Error("Review queued submissions before adding more");
      const entry = prepare(account); rows.push(entry); return structuredClone(entry);
    }),
    pendingFor: account => chain.then(read).then(rows => rows.filter(entry => owned(entry, account) && entry.state !== "blocked")),
    acknowledge: account => transact(rows => {
      const index = rows.findIndex(entry => owned(entry, account) && entry.eventId === account.eventId);
      if (index >= 0) rows.splice(index, 1);
    }),
    pause: (account, state) => transact(rows => {
      const entry = rows.find(item => owned(item, account) && item.eventId === account.eventId);
      if (entry) entry.state = state;
    }),
    summary: account => chain.then(read).then(rows => ({
      queued: rows.filter(entry => owned(entry, account)).length,
      needsMatching: rows.filter(entry => owned(entry, account) && entry.state === "needs_matching").length,
      blocked: rows.filter(entry => owned(entry, account) && entry.state === "blocked").length,
      legacy: rows.filter(entry => claimable(entry, account)).length,
    })),
    adoptLegacy: account => transact(rows => {
      for (let i = 0; i < rows.length; i++) if (claimable(rows[i], account)) {
        rows[i] = prepare({ ...account, job: rows[i].job || rows[i] });
      }
    }),
  };
}
