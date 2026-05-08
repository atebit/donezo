"use server";
import { revalidateTag } from "next/cache";
import { withUser } from "@/lib/actions";
import { requireWorkspaceRole } from "@/lib/authorization";
import { SetLastWorkspaceSchema } from "@/lib/validations/profile";
import { CreateWorkspaceSchema } from "@/lib/validations/workspace";

export const createWorkspace = withUser(async ({ supabase }, raw) => {
  const input = CreateWorkspaceSchema.parse(raw);
  const { data, error } = await supabase
    .rpc("create_workspace", { p_name: input.name, p_slug: input.slug })
    .single();
  if (error) {
    if (error.code === "23505") {
      throw { code: "VALIDATION", message: "That slug is taken.", field: "slug" };
    }
    throw { code: "DB", message: error.message };
  }
  return data;
});

export const setLastWorkspace = withUser(async ({ supabase, userId }, raw) => {
  const input = SetLastWorkspaceSchema.parse(raw);
  await requireWorkspaceRole(input.workspaceId, "viewer");
  const { error } = await supabase
    .from("profile")
    .update({ last_workspace_id: input.workspaceId })
    .eq("id", userId);
  if (error) throw { code: "DB", message: error.message };
  revalidateTag(`profile:${userId}`);
});
