import { createClient } from "@/lib/supabase/server";

export const ROLE_RANK = { viewer: 1, member: 2, admin: 3, owner: 4 } as const;
export type Role = keyof typeof ROLE_RANK;

// TODO(F1): tighten cast once `supabase gen types typescript` adds role_for_board to Database['public']['Functions']
export async function getBoardRole(boardId: string): Promise<Role | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // biome-ignore lint/suspicious/noExplicitAny: RPC return type not yet in generated types; F1 tightens
  const { data, error } = await (supabase as any).rpc("role_for_board", {
    p_board_id: boardId,
    p_user_id: user.id,
  });
  if (error) throw { code: "DB", message: error.message };
  return (data as Role | null) ?? null;
}

export async function requireBoardRole(boardId: string, minRole: Role): Promise<Role> {
  const role = await getBoardRole(boardId);
  if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw { code: "FORBIDDEN", message: "Insufficient permissions" };
  }
  return role;
}
