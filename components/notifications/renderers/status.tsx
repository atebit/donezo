import type { TypedNotification } from "@/lib/notifications/types";

export function StatusChangedAssignedRenderer({
  notification,
}: {
  notification: TypedNotification<"status_changed_assigned">;
}) {
  void notification;
  return (
    <p className="text-sm text-[var(--color-fg-base)]">Status changed on a task assigned to you.</p>
  );
}

export function StatusChangedFollowedRenderer({
  notification,
}: {
  notification: TypedNotification<"status_changed_followed">;
}) {
  void notification;
  return (
    <p className="text-sm text-[var(--color-fg-base)]">Status changed on a task you follow.</p>
  );
}
