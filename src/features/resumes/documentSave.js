// One document's revisioned save boundary. Conflict blocks every queued/future
// write until the editor is reloaded; transport errors remain retryable.
export function createDocumentSaver({ revision = 0, initialSnapshot = null, save }) {
  let currentRevision = revision, lastSnapshot = initialSnapshot, conflict = null;
  let queue = Promise.resolve();
  function saveSnapshot(snapshot) {
    queue = queue.then(async () => {
      if (conflict) return conflict;
      if (snapshot === lastSnapshot) return { ok: true, data: { revision: currentRevision } };
      let result;
      try { result = await save({ ...snapshot, revision: currentRevision }); }
      catch { result = { ok: false, error: "Not saved. Check your connection and try again." }; }
      if (result?.ok && Number.isInteger(result.data?.revision) && result.data.revision > currentRevision) {
        currentRevision = result.data.revision; lastSnapshot = snapshot;
        return result;
      }
      if (result?.status === 409) conflict = result;
      return result?.ok ? { ok: false, error: "The save could not be confirmed. Keep this tab open and retry." }
        : result || { ok: false, error: "Not saved. Please try again." };
    });
    return queue;
  }
  return { saveSnapshot, isConflicted: () => Boolean(conflict) };
}
