"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CurrentUser } from "@/lib/auth/current-user";
import {
  type UpdateEmailInput,
  UpdateEmailSchema,
  type UpdatePasswordInput,
  UpdatePasswordSchema,
  type UpdateProfileInput,
  UpdateProfileSchema,
} from "@/lib/validations/auth";
import {
  signOutEverywhere,
  updateAvatar,
  updateEmail,
  updatePassword,
  updateProfile,
} from "./actions";

interface AccountSettingsProps {
  user: CurrentUser;
}

// ── Profile section ─────────────────────────────────────────────────────────

function ProfileSection({ user }: { user: CurrentUser }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileSchema),
    defaultValues: { displayName: user.displayName ?? "" },
  });

  const onSubmit = async (data: UpdateProfileInput) => {
    const result = await updateProfile(data);
    if (result.ok) {
      toast.success("Profile updated.");
    } else {
      if (result.error.field) {
        toast.error(result.error.message);
      } else {
        toast.error(result.error.message);
      }
    }
  };

  return (
    <section aria-labelledby="profile-heading" className="rounded-xl border border-border p-6">
      <h2 id="profile-heading" className="mb-4 text-base font-semibold">
        Profile
      </h2>

      {/* Avatar upload */}
      <AvatarSection user={user} />

      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            type="text"
            autoComplete="name"
            aria-invalid={!!errors.displayName}
            {...register("displayName")}
          />
          {errors.displayName && (
            <p className="text-sm text-destructive" role="alert">
              {errors.displayName.message}
            </p>
          )}
        </div>

        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            Email: <span className="font-medium text-foreground">{user.email}</span>
          </p>
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </section>
  );
}

// ── Avatar sub-section (FormData upload) ────────────────────────────────────

function AvatarSection({ user }: { user: CurrentUser }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be 2 MB or smaller.");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    startTransition(async () => {
      const result = await updateAvatar(formData);
      if (result.ok) {
        setAvatarUrl(result.data.avatarUrl);
        toast.success("Avatar updated.");
      } else {
        toast.error(result.error.message);
      }
    });
  };

  return (
    <div className="flex items-center gap-4">
      {/* Avatar preview */}
      <div className="size-16 overflow-hidden rounded-full bg-muted">
        {avatarUrl ? (
          // biome-ignore lint/performance/noImgElement: avatar URL from Supabase Storage; next/image requires remotePatterns config not scoped to this slice
          <img
            src={avatarUrl}
            alt={user.displayName ?? "Avatar"}
            className="size-full object-cover"
            width={64}
            height={64}
          />
        ) : (
          <div
            className="flex size-full items-center justify-center text-xl font-semibold text-muted-foreground"
            aria-hidden="true"
          >
            {(user.displayName ?? user.email).charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => fileRef.current?.click()}
        >
          {isPending ? "Uploading…" : "Change avatar"}
        </Button>
        <p className="text-xs text-muted-foreground">JPG, PNG, GIF, WebP — max 2 MB</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Upload avatar"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}

// ── Email section ────────────────────────────────────────────────────────────

function EmailSection({ user }: { user: CurrentUser }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<UpdateEmailInput>({
    resolver: zodResolver(UpdateEmailSchema),
    defaultValues: { email: user.email },
  });
  const [sent, setSent] = useState(false);

  const onSubmit = async (data: UpdateEmailInput) => {
    const result = await updateEmail(data);
    if (result.ok) {
      setSent(true);
      toast.success("Confirmation link sent. Check your new inbox.");
    } else {
      if (result.error.field === "email") {
        setError("email", { message: result.error.message });
      } else {
        toast.error(result.error.message);
      }
    }
  };

  return (
    <section aria-labelledby="email-heading" className="rounded-xl border border-border p-6">
      <h2 id="email-heading" className="mb-4 text-base font-semibold">
        Email address
      </h2>

      {sent ? (
        <p className="text-sm text-muted-foreground">
          Check your new inbox for a confirmation link. Click it to complete the change.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating…" : "Update email"}
          </Button>
        </form>
      )}
    </section>
  );
}

// ── Password section ─────────────────────────────────────────────────────────

function PasswordSection() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<UpdatePasswordInput>({
    resolver: zodResolver(UpdatePasswordSchema),
    defaultValues: { password: "" },
  });

  const onSubmit = async (data: UpdatePasswordInput) => {
    const result = await updatePassword(data);
    if (result.ok) {
      reset();
      toast.success("Password updated.");
    } else {
      if (result.error.field === "password") {
        setError("password", { message: result.error.message });
      } else {
        toast.error(result.error.message);
      }
    }
  };

  return (
    <section aria-labelledby="password-heading" className="rounded-xl border border-border p-6">
      <h2 id="password-heading" className="mb-4 text-base font-semibold">
        Change password
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password && (
            <p className="text-sm text-destructive" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </section>
  );
}

// ── Sessions section ─────────────────────────────────────────────────────────

function SessionsSection() {
  const [isPending, startTransition] = useTransition();

  const handleSignOutEverywhere = () => {
    startTransition(async () => {
      const result = await signOutEverywhere();
      // If result returns (sign-out failed before redirect), show error.
      if (!result.ok) {
        toast.error(result.error.message);
      }
      // On success, signOutEverywhere redirects to /sign-in — no client action needed.
    });
  };

  return (
    <section aria-labelledby="sessions-heading" className="rounded-xl border border-border p-6">
      <h2 id="sessions-heading" className="mb-4 text-base font-semibold">
        Sessions
      </h2>

      <p className="mb-4 text-sm text-muted-foreground">
        Sign out of all devices and sessions, including this one.
      </p>

      <Button
        type="button"
        variant="destructive"
        disabled={isPending}
        onClick={handleSignOutEverywhere}
      >
        {isPending ? "Signing out…" : "Sign out everywhere"}
      </Button>
    </section>
  );
}

// ── Root component ───────────────────────────────────────────────────────────

export function AccountSettings({ user }: AccountSettingsProps) {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Account settings</h1>

      <ProfileSection user={user} />
      <EmailSection user={user} />
      <PasswordSection />
      <SessionsSection />
    </main>
  );
}
