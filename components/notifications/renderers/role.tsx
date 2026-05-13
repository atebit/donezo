import type { TypedNotification } from "@/lib/notifications/types";

export function RoleChangedRenderer({
  notification,
}: {
  notification: TypedNotification<"role_changed">;
}) {
  const { to } = notification.payload;
  return (
    <p className="text-sm text-[var(--color-fg-base)]">
      Your role was changed to <span className="font-medium">{to}</span>.
    </p>
  );
}
