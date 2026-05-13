import type { TypedNotification } from "@/lib/notifications/types";

export function BoardInviteRenderer({
  notification,
}: {
  notification: TypedNotification<"board_invite">;
}) {
  void notification;
  return <p className="text-sm text-[var(--color-fg-base)]">You were invited to a board.</p>;
}
