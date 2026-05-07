"use client";

import { useTransition } from "react";
import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          signOut().then(() => {});
        })
      }
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
