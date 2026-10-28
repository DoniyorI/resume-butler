import "server-only";
import { setTimeout as delay } from "node:timers/promises";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
// Overrides are opt-in; existing deployments retain their configured default.
const MODEL_ENV_BY_TASK = {
  email: "OPENAI_EMAIL_MODEL",
  writing: "OPENAI_WRITING_MODEL",
  selection: "OPENAI_SELECTION_MODEL",
  import: "OPENAI_IMPORT_MODEL",
};

// Sends a chat completion that must return a JSON object, and returns it parsed
export async function chatJSON({
  system, user, task, schema, schemaName = "result", maxTokens, temperature, timeoutMs = 60_000,
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  const model = process.env[MODEL_ENV_BY_TASK[task]] || process.env.OPENAI_MODEL || "gpt-6-luna";
  const reasoningModel = /^(gpt-[56]|o[134])/.test(model);
  const noReasoning = /^gpt-6(?:\.\d+)?-(luna|terra)/.test(model);
  const signal = AbortSignal.timeout(timeoutMs);
  const body = {
    model,
    response_format: schema
      ? { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } }
      : { type: "json_object" },
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    ...(maxTokens ? { [reasoningModel ? "max_completion_tokens" : "max_tokens"]: maxTokens } : {}),
    ...(reasoningModel ? { reasoning_effort: noReasoning ? "none" : "low" } : {}),
    ...(!reasoningModel && temperature !== undefined ? { temperature } : {}),
  };

  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal,
    });
    const transient = response.status === 429 || response.status >= 500;
    if (response.ok || !transient || attempt === 1) break;
    const retryAfter = Number(response.headers.get("retry-after"));
    if (retryAfter > 1) break;
    await response.body?.cancel();
    await delay(retryAfter > 0 ? retryAfter * 1000 : 250, undefined, { signal });
  }
  // Provider errors can echo request text. Keep them out of runtime logs.
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}`);

  const data = await response.json();
  const choice = data.choices?.[0];
  if (choice?.message?.refusal) throw new Error("AI response unavailable: refusal");
  if (choice?.finish_reason !== "stop") throw new Error("AI response was incomplete or truncated");
  if (typeof choice.message?.content !== "string") throw new Error("AI returned an invalid JSON object");
  let parsed;
  try { parsed = JSON.parse(choice.message.content); }
  catch { throw new Error("AI returned an invalid JSON object"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI returned an invalid JSON object");
  }
  return parsed;
}
