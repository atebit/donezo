import type { TypedNotification } from "@/lib/notifications/types";

export function MentionRenderer({ notification }: { notification: TypedNotification<"mention"> }) {
  const { task_id } = notification.payload;
  return (
    <p className="text-sm text-[var(--color-fg-base)]">
      <span className="font-medium">Someone</span> mentioned you in a comment
      {task_id ? " on a task" : ""}.
    </p>
  );
}
