"use server";
import { withUser } from "@/lib/actions";
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
