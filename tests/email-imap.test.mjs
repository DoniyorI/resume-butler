import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mock, test } from "node:test";

class SilentImap extends EventEmitter {
  static ready = false;
  static options;
  constructor(options) { super(); SilentImap.options = options; }
  connect() { if (SilentImap.ready) queueMicrotask(() => this.emit("ready")); }
  serverSupports() { return false; }
  openBox(_name, readOnly, callback) { assert.equal(readOnly, true); callback(null); }
  search(_criteria, callback) { callback(null, Array.from({ length: 301 }, (_, i) => i + 1)); }
  fetch(ids) {
    assert.equal(ids.length, 300);
    const stream = new EventEmitter();
    queueMicrotask(() => stream.emit("end"));
    return stream;
  }
  destroy() {}
  end() {}
}
mock.module("imap", { defaultExport: SilentImap });
const { fetchEmails } = await import("@/server/email/imapClient");

test("IMAP honors a caller's remaining deadline instead of waiting 90 seconds", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let outcome = "pending";
  fetchEmails({ host: "imap.gmail.com", user: "qa@example.test", password: "synthetic" }, {
    since: new Date("2026-10-20"), before: new Date("2026-10-28"), timeoutMs: 15,
  }).then(() => { outcome = "success"; }, () => { outcome = "timeout"; });
  t.mock.timers.tick(20);
  await Promise.resolve();
  assert.equal(outcome, "timeout");
});

test("an IMAP search exceeding the transport cap reports omitted messages", async () => {
  SilentImap.ready = true;
  try {
    const result = await fetchEmails({ host: "imap.gmail.com", user: "qa@example.test", password: "synthetic" }, {
      since: new Date("2026-10-20"), before: new Date("2026-10-28"),
    });
    assert.equal(result.truncated, 1);
    assert.equal(SilentImap.options.tls, true);
    assert.equal(SilentImap.options.tlsOptions.rejectUnauthorized, true);
  } finally { SilentImap.ready = false; }
});
