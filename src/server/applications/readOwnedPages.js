import "server-only";

// Supabase caps one request at 1,000 rows. Truncation cannot decide identity.
export async function readOwnedPages(supabase, userId, table, columns, { pending = false, legacyColumns } = {}) {
  const rows = [];
  let projection = columns;
  for (let from = 0; ; from += 1000) {
    let query = supabase.from(table).select(projection).eq("user_id", userId);
    if (pending) query = query.eq("state", "pending");
    const { data, error } = await query.order("id").range(from, from + 999);
    if (error && from === 0 && legacyColumns && ["42703", "PGRST204"].includes(error.code) && projection !== legacyColumns) {
      projection = legacyColumns; from = -1000; continue;
    }
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
