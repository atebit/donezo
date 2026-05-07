"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/actions";
import { withUser } from "@/lib/actions";
import { updateProfileRow } from "@/lib/auth/profile";
import {
  UpdateEmailSchema,
  UpdatePasswordSchema,
  UpdateProfileSchema,
} from "@/lib/validations/auth";

export const updateProfile = withUser(async ({ userId }, raw) => {
  const input = UpdateProfileSchema.parse(raw);
  await updateProfileRow(userId, { display_name: input.displayName });
  return { displayName: input.displayName };
});

// Avatar upload uses FormData — handled separately from withUser to read File from FormData.
// The action calls the internal withUser-wrapped helper after extracting the file.
const _uploadAvatar = withUser(async ({ supabase, userId }, formData: FormData) => {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    throw { code: "VALIDATION", message: "No file provided." };
  }
  if (!file.type.startsWith("image/")) {
    throw { code: "VALIDATION", message: "File must be an image.", field: "avatar" };
  }
  if (file.size > 2 * 1024 * 1024) {
    throw { code: "VALIDATION", message: "Image must be 2 MB or smaller.", field: "avatar" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw { code: "STORAGE", message: uploadError.message };

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = urlData.publicUrl;

  await updateProfileRow(userId, { avatar_url: avatarUrl });
  return { avatarUrl };
});

export async function updateAvatar(
  formData: FormData,
): Promise<ActionResult<{ avatarUrl: string }>> {
  return _uploadAvatar(formData);
}

export const updateEmail = withUser(async ({ supabase }, raw) => {
  const input = UpdateEmailSchema.parse(raw);
  const { error } = await supabase.auth.updateUser({ email: input.email });
  if (error) throw { code: "AUTH", message: error.message };
  return { pendingEmail: input.email };
});

export const updatePassword = withUser(async ({ supabase }, raw) => {
  const input = UpdatePasswordSchema.parse(raw);
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) throw { code: "AUTH", message: error.message };
  return { ok: true as const };
});

// signOutEverywhere: sign out inside withUser, then redirect outside to avoid
// swallowing the Next.js redirect error in the withUser try/catch.
const _signOutAction = withUser(async ({ supabase }) => {
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) throw { code: "AUTH", message: error.message };
  return { ok: true as const };
});

export async function signOutEverywhere(): Promise<ActionResult<{ ok: true }>> {
  const result = await _signOutAction(undefined);
  if (result.ok) redirect("/sign-in");
  return result;
}
