import "server-only";

export async function getUnresolvedExtensionEvents(supabase) {
  const { data, error } = await supabase.rpc("list_unresolved_extension_events");
  if (["PGRST202", "42883"].includes(error?.code)) return [];
  if (error) throw new Error(`Could not load submission review (${error.code || "unknown"})`);
  if (!Array.isArray(data)) throw new Error("Invalid submission review result");
  return data;
}
