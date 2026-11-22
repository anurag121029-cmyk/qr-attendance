import type { SupabaseClient } from "@supabase/supabase-js";

export type Role = "admin" | "teacher" | "student";

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  roll_no: string | null;
  department: string | null;
}

export async function getProfile(
  sb: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data } = await sb.from("profiles").select("id, role, full_name, roll_no, department").eq("id", userId).single();
  return (data as Profile | null) ?? null;
}
