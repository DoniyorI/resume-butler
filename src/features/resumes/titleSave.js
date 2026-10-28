// Serial title writes share the editor's save indicator. Consecutive flushes
// coalesce, but A -> B -> A keeps the final A after the queued B.
export function createTitleSave({ initial, save, onState, onRevert = () => {} }) {
  let saved = initial, draft = initial, queue = Promise.resolve(), pending = 0;
  let last = null, error = null, disposed = false;
  const publish = () => {
    if (!disposed) onState({
      status: pending > 0 ? "saving" : draft.trim() === saved ? "saved" : error ? "error" : "saving",
      error,
    });
  };
  return {
    update(value) { draft = value; error = null; publish(); },
    flush() {
      let title = draft.trim();
      if (!title) { title = saved; draft = saved; onRevert(saved); }
      if (!pending && title === saved) { publish(); return Promise.resolve(); }
      if (pending && last?.title === title) return last.promise;
      pending++;
      error = null;
      publish();
      const request = { title, promise: null };
      last = request;
      request.promise = queue = queue.then(async () => {
        try {
          const result = await save(title);
          if (!result?.ok) throw new Error(result?.error || "Could not save the document name.");
          saved = title;
          error = null;
        } catch (failure) {
          if (last === request) error = failure.message || "Could not save the document name.";
        } finally {
          pending--;
          publish();
        }
      });
      return request.promise;
    },
    hasUnsaved: () => pending > 0 || draft.trim() !== saved,
    dispose() { disposed = true; },
  };
}
