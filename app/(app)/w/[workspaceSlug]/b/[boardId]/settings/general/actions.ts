"use server";
import { revalidateTag } from "next/cache";
import { withUser } from "@/lib/actions";
import { requireBoardRole } from "@/lib/authorization";
import { SetBoardPrivacySchema, UpdateBoardDescriptionSchema } from "@/lib/validations/board";

export const updateBoardDescription = withUser(async ({ supabase }, raw) => {
  const input = UpdateBoardDescriptionSchema.parse(raw);
  await requireBoardRole(input.boardId, "member");

  const { error } = await supabase
    .from("board")
    .update({ description: input.description, updated_at: new Date().toISOString() })
    .eq("id", input.boardId);
  if (error) throw { code: "DB", message: error.message };

  revalidateTag(`board:${input.boardId}`);
});

export const setBoardPrivacy = withUser(async ({ supabase, userId }, raw) => {
  const input = SetBoardPrivacySchema.parse(raw);
  await requireBoardRole(input.boardId, "admin");

  const { error } = await supabase
    .from("board")
    .update({ is_private: input.isPrivate, updated_at: new Date().toISOString() })
    .eq("id", input.boardId);
  if (error) throw { code: "DB", message: error.message };

  // When making a board private, ensure the caller retains access as owner
  // (mirrors the create_board RPC behavior so the caller cannot lock themselves out).
  if (input.isPrivate) {
    const { error: memberError } = await supabase
      .from("board_member")
      .upsert(
        { board_id: input.boardId, user_id: userId, role: "owner" },
        { onConflict: "board_id,user_id" },
      );
    if (memberError) throw { code: "DB", message: memberError.message };
  }

  revalidateTag(`board:${input.boardId}`);
});
