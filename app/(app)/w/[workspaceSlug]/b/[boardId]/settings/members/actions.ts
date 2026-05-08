"use server";
import { revalidateTag } from "next/cache";
import { withUser } from "@/lib/actions";
import { requireBoardRole } from "@/lib/authorization";
import { RemoveBoardMemberSchema, SetBoardMemberRoleSchema } from "@/lib/validations/board";

export const setBoardMemberRole = withUser(async ({ supabase }, raw) => {
  const input = SetBoardMemberRoleSchema.parse(raw);
  await requireBoardRole(input.boardId, "admin");

  const { error } = await supabase
    .from("board_member")
    .update({ role: input.role })
    .eq("board_id", input.boardId)
    .eq("user_id", input.userId);
  if (error) throw { code: "DB", message: error.message };

  revalidateTag(`board-members:${input.boardId}`);
});

export const removeBoardMember = withUser(async ({ supabase }, raw) => {
  const input = RemoveBoardMemberSchema.parse(raw);
  await requireBoardRole(input.boardId, "admin");

  const { error } = await supabase
    .from("board_member")
    .delete()
    .eq("board_id", input.boardId)
    .eq("user_id", input.userId);
  if (error) throw { code: "DB", message: error.message };

  revalidateTag(`board-members:${input.boardId}`);
});
