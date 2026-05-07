"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { resendVerificationEmail } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const RESEND_COOLDOWN_MS = 30_000;
const POLL_INTERVAL_MS = 3_000;

export function VerifyEmailClient() {
  const router = useRouter();
  const [resendPending, startResendTransition] = useTransition();
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll getUser() every 3s; when email_confirmed_at is set, redirect to /.
  useEffect(() => {
    const supabase = createClient();

    const intervalId = setInterval(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email_confirmed_at) {
        clearInterval(intervalId);
        router.push("/");
      }
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [router]);

  // Countdown tick for resend button cooldown.
  useEffect(() => {
    if (cooldownRemaining <= 0) return;

    tickRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1000) {
          if (tickRef.current) clearInterval(tickRef.current);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [cooldownRemaining]);

  function handleResend() {
    startResendTransition(async () => {
      const result = await resendVerificationEmail();
      if (result.ok) {
        toast.success("Verification email sent.");
        setCooldownRemaining(RESEND_COOLDOWN_MS);
        cooldownRef.current = setTimeout(() => {
          setCooldownRemaining(0);
        }, RESEND_COOLDOWN_MS);
      } else {
        toast.error(result.error.message);
      }
    });
  }

  const resendDisabled = resendPending || cooldownRemaining > 0;
  const cooldownSecs = Math.ceil(cooldownRemaining / 1000);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent a verification link to your email address. Click it to activate your account. This
          page will automatically redirect once your email is confirmed.
        </p>
      </div>

      <Button type="button" variant="outline" disabled={resendDisabled} onClick={handleResend}>
        {resendPending
          ? "Sending…"
          : cooldownRemaining > 0
            ? `Resend in ${cooldownSecs}s`
            : "Resend verification email"}
      </Button>
    </div>
  );
}
