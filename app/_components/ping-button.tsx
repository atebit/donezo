"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { pingAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

export function PingButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await pingAction(undefined as never);
          if (res.ok) toast.success(`pong @ ${res.data.timestamp}`);
          else toast.error(res.error.message);
        });
      }}
    >
      {pending ? "Pinging…" : "Ping"}
    </Button>
  );
}
