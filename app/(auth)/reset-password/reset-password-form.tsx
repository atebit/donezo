"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { resetPassword } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { type ResetPasswordInput, ResetPasswordSchema } from "@/lib/validations/auth";

type RecoveryState = "waiting" | "ready" | "invalid";

export function ResetPasswordForm() {
  const router = useRouter();
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("waiting");
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
  });

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryState("ready");
      }
    });

    // Check if we already have a session with a recovery token (page reload case)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setRecoveryState("ready");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  function onSubmit(values: ResetPasswordInput) {
    startTransition(async () => {
      const result = await resetPassword(values);
      if (!result) {
        // resetPassword redirects on success; this branch is unreachable in happy path
        router.push("/");
      } else if (!result.ok) {
        if (result.error.field) {
          setError(result.error.field as keyof ResetPasswordInput, {
            message: result.error.message,
          });
        } else {
          toast.error(result.error.message);
        }
      }
    });
  }

  if (recoveryState === "waiting") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Reset your password</h2>
        <p className="text-sm text-muted-foreground">
          Processing your reset link… If nothing happens, try clicking the link in your email again.
        </p>
      </div>
    );
  }

  if (recoveryState === "invalid") {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Link expired</h2>
        <p className="text-sm text-muted-foreground">
          This reset link is no longer valid. Request a new one below.
        </p>
        <Button variant="outline" onClick={() => router.push("/forgot-password")}>
          Request new link
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Set new password</h2>
        <p className="text-sm text-muted-foreground">
          Choose a strong password (at least 10 characters).
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "reset-password-error" : undefined}
            {...register("password")}
          />
          {errors.password && (
            <p id="reset-password-error" className="text-sm text-destructive" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving…" : "Set new password"}
        </Button>
      </form>
    </div>
  );
}
