import type { AnyNotification } from "@/stores/notification-store";

export function FallbackRenderer({ notification }: { notification: AnyNotification }) {
  return (
    <p className="text-sm text-[var(--color-fg-muted)]">{notification.kind.replace(/_/g, " ")}</p>
  );
}
