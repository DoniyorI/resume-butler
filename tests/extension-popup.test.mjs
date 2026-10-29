import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { test } from "node:test";

test("submission capture stays usable while resume metadata is unavailable", async () => {
  const elements = new Map(), sent = [];
  const node = id => {
    if (!elements.has(id)) elements.set(id, { onclick: null, addEventListener() {}, replaceChildren() {} });
    return elements.get(id);
  };
  const job = { company: "QA", role: "Engineer", url: "https://job-boards.greenhouse.io/acme/jobs/123" };
  vm.runInNewContext(await readFile(new URL("../extension/popup/popup.js", import.meta.url), "utf8"), {
    document: { getElementById: node }, Date, window: { close() {} },
    chrome: {
      runtime: { sendMessage: (message, callback) => {
        sent.push(message);
        if (message.type === "status") callback({ connection: { userId: "A", origin: "http://localhost:3000" }, recent: [] });
        // Deliberately never resolve the metadata request.
        if (message.type === "record") callback({ status: "queued" });
      } },
      tabs: { query: async () => [{ id: 1 }], sendMessage: (id, message, cb) => cb(job) },
    },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(node("record").disabled, false);
  assert.equal(typeof node("record").onclick, "function", "recording must not wait for resume choices");
  await node("record").onclick();
  assert.equal(sent.filter(message => message.type === "record").length, 1);
  assert.equal(sent.find(message => message.type === "record").account.userId, "A");
});
