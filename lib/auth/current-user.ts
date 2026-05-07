import { redirect } from "next/navigation";
// biome-ignore lint/style/noRestrictedImports: server-only helper — not a client component or "use client" file
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  emailConfirmedAt: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // TODO epic 04: switch to authed `supabase` client once profile RLS lands.
  // Until then, profile rows are unreadable to authed clients (default-deny).
  const admin = adminClient();
  const { data: profile } = await admin
    .from("profile")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: profile?.display_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
