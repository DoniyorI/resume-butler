import "server-only";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
// OPENAI_MODEL switches every AI feature to another chat model without a code change
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Sends a chat completion that must return a JSON object, and returns it parsed
export async function chatJSON({ system, user, maxTokens, temperature, timeoutMs = 60_000 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}
