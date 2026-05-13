import type { TypedNotification } from "@/lib/notifications/types";

export function DueSoonRenderer({ notification }: { notification: TypedNotification<"due_soon"> }) {
  void notification;
  return (
    <p className="text-sm text-[var(--color-fg-base)]">
      A task assigned to you is <span className="font-medium text-amber-600">due soon</span>.
    </p>
  );
}

export function DueOverdueRenderer({
  notification,
}: {
  notification: TypedNotification<"due_overdue">;
}) {
  void notification;
  return (
    <p className="text-sm text-[var(--color-fg-base)]">
      A task assigned to you is <span className="font-medium text-red-600">overdue</span>.
    </p>
  );
}
