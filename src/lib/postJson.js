// Client helper for our Route Handlers. They return errors as
// { error: "safe message" }, which is thrown here for the caller to toast.
export async function postJson(url, body, fallbackError = "Something went wrong. Please try again.") {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || fallbackError);
  return data;
}
