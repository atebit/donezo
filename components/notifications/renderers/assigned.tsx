import type { TypedNotification } from "@/lib/notifications/types";

export function AssignedRenderer({
  notification,
}: {
  notification: TypedNotification<"assigned">;
}) {
  void notification;
  return (
    <p className="text-sm text-[var(--color-fg-base)]">
      <span className="font-medium">Someone</span> assigned you to a task.
    </p>
  );
}

export function UnassignedRenderer({
  notification,
}: {
  notification: TypedNotification<"unassigned">;
}) {
  void notification;
  return (
    <p className="text-sm text-[var(--color-fg-base)]">
      <span className="font-medium">Someone</span> unassigned you from a task.
    </p>
  );
}
