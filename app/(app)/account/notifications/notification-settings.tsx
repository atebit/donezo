"use client";

/**
 * app/(app)/account/notifications/notification-settings.tsx
 *
 * Preferences UI for in-app and email notification settings.
 * Uses RHF + Zod (UpdatePreferencesSchema) — same schema validates client + server.
 *
 * Per row: in-app Switch + email Select (instant | digest | off).
 * Below: digest section — digest enabled Switch, hour Select (0-23), timezone Select.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DISPLAY_KINDS } from "@/lib/notifications/kinds";
import type { NotificationPreference } from "@/lib/notifications/types";
import {
  type UpdatePreferencesInput,
  UpdatePreferencesSchema,
} from "@/lib/validations/notifications";
import { updatePreferences } from "./actions";

/** Human-readable label for each kind. */
const KIND_LABELS: Record<string, string> = {
  mention: "Mentions",
  assigned: "Assigned to task",
  unassigned: "Unassigned from task",
  comment_reply: "Comment replies",
  comment_on_followed: "Comments on followed tasks",
  status_changed_assigned: "Status changes (assigned)",
  status_changed_followed: "Status changes (followed)",
  due_soon: "Due soon",
  due_overdue: "Overdue",
  board_invite: "Board invitations",
  role_changed: "Role changes",
};

const EMAIL_OPTIONS = [
  { value: "instant", label: "Instant" },
  { value: "digest", label: "Digest" },
  { value: "off", label: "Off" },
] as const;

/** Hours 0–23, displayed as "12 AM", "1 AM", …, "11 PM". */
function formatHour(h: number): string {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", hour12: true });
}

const HOURS = Array.from({ length: 24 }, (_, i) => ({ value: i, label: formatHour(i) }));

type Props = {
  preference: NotificationPreference | null;
};

export function NotificationSettings({ preference }: Props) {
  const [isPending, startTransition] = useTransition();

  const defaultValues: UpdatePreferencesInput = {
    prefs: preference?.prefs ? (preference.prefs as UpdatePreferencesInput["prefs"]) : {},
    digestEnabled: preference?.digest_enabled ?? false,
    digestHour: preference?.digest_hour ?? 9,
    digestTimezone: preference?.digest_timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  const {
    control,
    register,
    handleSubmit,
    formState: { isDirty },
  } = useForm<UpdatePreferencesInput>({
    resolver: zodResolver(UpdatePreferencesSchema),
    defaultValues,
  });

  const onSubmit = (data: UpdatePreferencesInput) => {
    startTransition(async () => {
      const result = await updatePreferences(data);
      if (result.ok) {
        toast.success("Notification preferences saved.");
      } else {
        toast.error(result.error.message);
      }
    });
  };

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Notification preferences</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Per-kind rows */}
        <section
          aria-labelledby="per-kind-heading"
          className="rounded-xl border border-border p-6 space-y-4"
        >
          <h2 id="per-kind-heading" className="text-base font-semibold">
            Notification types
          </h2>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1 border-b border-border">
            <span>Type</span>
            <span className="text-center">In-app</span>
            <span className="text-center">Email</span>
          </div>

          {DISPLAY_KINDS.map((kind) => (
            <div key={kind} className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center">
              <span className="text-sm text-foreground">{KIND_LABELS[kind] ?? kind}</span>

              {/* In-app toggle */}
              <Controller
                control={control}
                name={`prefs.${kind}.inApp` as `prefs.${string}.inApp`}
                render={({ field }) => (
                  <input
                    type="checkbox"
                    checked={field.value ?? true}
                    onChange={(e) => field.onChange(e.target.checked)}
                    aria-label={`Enable in-app ${KIND_LABELS[kind] ?? kind} notifications`}
                    className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                  />
                )}
              />

              {/* Email select */}
              <Controller
                control={control}
                name={`prefs.${kind}.email` as `prefs.${string}.email`}
                render={({ field }) => (
                  <select
                    value={field.value ?? "instant"}
                    onChange={(e) => field.onChange(e.target.value as "instant" | "digest" | "off")}
                    aria-label={`Email setting for ${KIND_LABELS[kind] ?? kind}`}
                    className="text-sm rounded-md border border-border bg-background px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {EMAIL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              />
            </div>
          ))}
        </section>

        {/* Digest section */}
        <section
          aria-labelledby="digest-heading"
          className="rounded-xl border border-border p-6 space-y-4"
        >
          <h2 id="digest-heading" className="text-base font-semibold">
            Email digest
          </h2>
          <p className="text-sm text-muted-foreground">
            Receive a daily digest email grouping all digest-mode notifications.
          </p>

          {/* Enabled toggle */}
          <Controller
            control={control}
            name="digestEnabled"
            render={({ field }) => (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                />
                <span className="text-sm text-foreground">Enable daily digest</span>
              </label>
            )}
          />

          {/* Hour select */}
          <div className="flex items-center gap-3">
            <label htmlFor="digest-hour" className="text-sm text-foreground min-w-24">
              Delivery time
            </label>
            <select
              id="digest-hour"
              {...register("digestHour", { valueAsNumber: true })}
              className="text-sm rounded-md border border-border bg-background px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {HOURS.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>

          {/* Timezone select */}
          <div className="flex items-center gap-3">
            <label htmlFor="digest-tz" className="text-sm text-foreground min-w-24">
              Timezone
            </label>
            <input
              id="digest-tz"
              type="text"
              {...register("digestTimezone")}
              placeholder="e.g. America/New_York"
              className="text-sm rounded-md border border-border bg-background px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-52"
            />
          </div>
        </section>

        <Button type="submit" disabled={isPending || !isDirty}>
          {isPending ? "Saving…" : "Save preferences"}
        </Button>
      </form>
    </main>
  );
}
