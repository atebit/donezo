import { createClient } from "@/lib/supabase/server";

export const ROLE_RANK = { viewer: 1, member: 2, admin: 3, owner: 4 } as const;
export type Role = keyof typeof ROLE_RANK;

export async function getBoardRole(boardId: string): Promise<Role | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc("role_for_board", {
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
