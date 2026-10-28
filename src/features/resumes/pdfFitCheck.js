// A small scheduler shared by automatic and manual PDF checks. It never treats
// an old compilation as confirmation of newly edited content.
export function createPdfFitCheck({ flush, compile, onChange, delayMs = 1500, cooldownMs = 30_000 }) {
  const cache = new Map();
  let current = null, timer = null, active = null, disposed = false;
  let lastAutomatic = -Infinity;
  const stopTimer = () => { if (timer !== null) clearTimeout(timer); timer = null; };
  const publish = state => { if (!disposed) onChange(state); };
  const remember = (key, value) => {
    cache.delete(key);
    cache.set(key, value);
    while (cache.size > 8) cache.delete(cache.keys().next().value);
  };
  function refresh() {
    stopTimer();
    if (disposed || !current) return;
    const saved = cache.get(current.key);
    publish(saved ? { ...saved, key: current.key }
      : { status: active ? "checking" : "idle", key: current.key, pages: null, error: null });
    if (current.over && !saved && !active) {
      const delay = Math.max(delayMs, lastAutomatic + cooldownMs - Date.now());
      timer = setTimeout(() => { timer = null; void run(false); }, delay);
    }
  }
  function run(manual) {
    stopTimer();
    if (disposed || !current) return Promise.resolve();
    if (active) return active.promise;
    const key = current.key;
    const saved = cache.get(key);
    if (saved?.status === "done") { refresh(); return Promise.resolve(); }
    if (!manual) lastAutomatic = Date.now();
    const operation = { key, promise: null };
    active = operation;
    publish({ status: "checking", key, pages: null, error: null });
    operation.promise = (async () => {
      try {
        if (!(await flush())) throw new Error("Save the document before checking the PDF.");
        if (disposed || current.key !== key) return;
        const pages = await compile(key);
        if (!Number.isInteger(pages) || pages < 1) throw new Error("Could not read the PDF page count.");
        remember(key, { status: "done", pages, error: null });
      } catch (error) {
        remember(key, { status: "error", pages: null, error: error.message || "Could not check the PDF." });
      } finally {
        active = null;
        refresh();
      }
    })();
    return operation.promise;
  }
  return {
    update(key, over) { current = { key, over }; refresh(); },
    checkNow: () => run(true),
    dispose() { disposed = true; stopTimer(); },
  };
}
