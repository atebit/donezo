"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { signInWithGoogle, signUpWithEmail } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type SignUpInput, SignUpSchema } from "@/lib/validations/auth";

export function SignUpForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [googlePending, startGoogleTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(SignUpSchema),
  });

  function onSubmit(values: SignUpInput) {
    startTransition(async () => {
      const result = await signUpWithEmail(values);
      if (result.ok) {
        router.push("/verify-email");
      } else if (result.error.field) {
        setError(result.error.field as keyof SignUpInput, {
          message: result.error.message,
        });
      } else {
        toast.error(result.error.message);
      }
    });
  }

  function handleGoogleSignIn() {
    startGoogleTransition(async () => {
      const result = await signInWithGoogle();
      if (result.ok) {
        window.location.href = result.data.url;
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Create an account</h2>
        <p className="text-sm text-muted-foreground">Fill in your details to get started.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="displayName">Name</Label>
          <Input
            id="displayName"
            type="text"
            autoComplete="name"
            required
            aria-invalid={!!errors.displayName}
            aria-describedby={errors.displayName ? "sign-up-displayName-error" : undefined}
            {...register("displayName")}
          />
          {errors.displayName && (
            <p id="sign-up-displayName-error" className="text-sm text-destructive" role="alert">
              {errors.displayName.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "sign-up-email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <p id="sign-up-email-error" className="text-sm text-destructive" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "sign-up-password-error" : undefined}
            {...register("password")}
          />
          {errors.password && (
            <p id="sign-up-password-error" className="text-sm text-destructive" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div className="relative flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={googlePending}
        onClick={handleGoogleSignIn}
        className="w-full"
      >
        {googlePending ? "Redirecting…" : "Continue with Google"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="underline underline-offset-4 hover:text-foreground">
          Sign in
        </Link>
      </p>
    </div>
  );
}
