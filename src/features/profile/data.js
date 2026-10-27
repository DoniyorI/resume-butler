import "server-only";

export async function getProfile(supabase, user) {
  const { data, error } = await supabase
    .from("profiles")
    .select("email, first_name, last_name, phone, location, linkedin, github, portfolio, other_links")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  return {
    firstName: data?.first_name || "",
    lastName: data?.last_name || "",
    email: data?.email || user.email || "",
    phone: data?.phone || "",
    location: data?.location || "",
    linkedin: data?.linkedin || "",
    github: data?.github || "",
    portfolio: data?.portfolio || "",
    otherLinks: data?.other_links || "",
  };
}
