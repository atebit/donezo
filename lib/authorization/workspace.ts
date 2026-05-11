import { createClient } from "@/lib/supabase/server";
import { ROLE_RANK, type Role } from "./roles";

export async function getWorkspaceRole(workspaceId: string): Promise<Role | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("workspace_member")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw { code: "DB", message: error.message };
  return (data?.role as Role | undefined) ?? null;
}

export async function requireWorkspaceRole(workspaceId: string, minRole: Role): Promise<Role> {
  const role = await getWorkspaceRole(workspaceId);
  if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw { code: "FORBIDDEN", message: "Insufficient permissions" };
  }
  return role;
}
