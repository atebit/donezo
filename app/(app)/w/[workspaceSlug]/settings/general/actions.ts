"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { withUser } from "@/lib/actions";
import { requireWorkspaceRole } from "@/lib/authorization";
import {
  DeleteWorkspaceSchema,
  RenameWorkspaceSchema,
  UpdateWorkspaceSlugSchema,
} from "@/lib/validations/workspace";

export const renameWorkspace = withUser(async ({ supabase }, raw) => {
  const input = RenameWorkspaceSchema.parse(raw);
  await requireWorkspaceRole(input.workspaceId, "admin");
  const { error } = await supabase
    .from("workspace")
    .update({ name: input.name })
    .eq("id", input.workspaceId);
  if (error) throw { code: "DB", message: error.message };
  revalidateTag(`workspace:${input.workspaceId}`);
});

export const updateWorkspaceSlug = withUser(async ({ supabase }, raw) => {
  const input = UpdateWorkspaceSlugSchema.parse(raw);
  await requireWorkspaceRole(input.workspaceId, "owner");
  const { error } = await supabase
    .from("workspace")
    .update({ slug: input.slug })
    .eq("id", input.workspaceId);
  if (error) {
    if (error.code === "23505") {
      throw { code: "VALIDATION", message: "That slug is taken.", field: "slug" };
    }
    throw { code: "DB", message: error.message };
  }
  revalidateTag(`workspace:${input.workspaceId}`);
  redirect(`/w/${input.slug}/settings/general`);
});

export const deleteWorkspace = withUser(async ({ supabase }, raw) => {
  const input = DeleteWorkspaceSchema.parse(raw);
  await requireWorkspaceRole(input.workspaceId, "owner");
  const { data: workspace, error: fetchError } = await supabase
    .from("workspace")
    .select("name")
    .eq("id", input.workspaceId)
    .single();
  if (fetchError || !workspace)
    throw { code: "DB", message: fetchError?.message ?? "Workspace not found." };
  if (input.confirmName !== workspace.name) {
    throw { code: "VALIDATION", message: "Name does not match.", field: "confirmName" };
  }
  const { error } = await supabase
    .from("workspace")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", input.workspaceId);
  if (error) throw { code: "DB", message: error.message };
  revalidateTag(`workspace:${input.workspaceId}`);
  redirect("/");
});
