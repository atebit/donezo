"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/actions/with-user";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  type ForgotPasswordInput,
  ForgotPasswordSchema,
  type ResetPasswordInput,
  ResetPasswordSchema,
  type SignInInput,
  SignInSchema,
  type SignUpInput,
  SignUpSchema,
} from "@/lib/validations/auth";

function validationError(
  message: string,
  field?: string,
): { ok: false; error: { code: string; message: string; field?: string } } {
  return {
    ok: false,
    error: field ? { code: "VALIDATION", message, field } : { code: "VALIDATION", message },
  };
}

export async function signInWithEmail(input: SignInInput): Promise<ActionResult<{ ok: true }>> {
  const parsed = SignInSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const fieldPath = first?.path.join(".");
    return validationError(first?.message ?? "Invalid input.", fieldPath || undefined);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: { code: "AUTH", message: error.message } };
  }

  return { ok: true, data: { ok: true } };
}

export async function signUpWithEmail(
  input: SignUpInput,
  next?: string,
): Promise<ActionResult<{ ok: true }>> {
  const parsed = SignUpSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const fieldPath = first?.path.join(".");
    return validationError(first?.message ?? "Invalid input.", fieldPath || undefined);
  }

  // Thread `next` into emailRedirectTo so the verification link returns the
  // new user to where they came from (e.g. /join/<token>) instead of /.
  const emailRedirectTo =
    next && next !== "/"
      ? `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`
      : `${env.NEXT_PUBLIC_SITE_URL}/auth/callback`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo,
    },
  });

  if (error) {
    return { ok: false, error: { code: "AUTH", message: error.message } };
  }

  return { ok: true, data: { ok: true } };
}

export async function signInWithGoogle(next?: string): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();
  const redirectTo = next
    ? `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`
    : `${env.NEXT_PUBLIC_SITE_URL}/auth/callback`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return {
      ok: false,
      error: { code: "AUTH", message: error?.message ?? "Failed to initiate Google sign-in." },
    };
  }

  return { ok: true, data: { url: data.url } };
}

export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<ActionResult<{ ok: true }>> {
  const parsed = ForgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const fieldPath = first?.path.join(".");
    return validationError(first?.message ?? "Invalid input.", fieldPath || undefined);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/reset-password`,
  });

  if (error) {
    return { ok: false, error: { code: "AUTH", message: error.message } };
  }

  return { ok: true, data: { ok: true } };
}

export async function resetPassword(
  input: ResetPasswordInput,
): Promise<ActionResult<{ ok: true }>> {
  const parsed = ResetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const fieldPath = first?.path.join(".");
    return validationError(first?.message ?? "Invalid input.", fieldPath || undefined);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { ok: false, error: { code: "AUTH", message: error.message } };
  }

  redirect("/");
}

export async function signOut(): Promise<ActionResult<{ ok: true }>> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export async function resendVerificationEmail(): Promise<ActionResult<{ ok: true }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return {
      ok: false,
      error: { code: "AUTH", message: "No active session found." },
    };
  }

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email,
  });

  if (error) {
    return { ok: false, error: { code: "AUTH", message: error.message } };
  }

  return { ok: true, data: { ok: true } };
}
