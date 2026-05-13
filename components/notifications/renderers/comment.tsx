import type { TypedNotification } from "@/lib/notifications/types";

export function CommentReplyRenderer({
  notification,
}: {
  notification: TypedNotification<"comment_reply">;
}) {
  void notification;
  return (
    <p className="text-sm text-[var(--color-fg-base)]">
      <span className="font-medium">Someone</span> replied to your comment.
    </p>
  );
}

export function CommentOnFollowedRenderer({
  notification,
}: {
  notification: TypedNotification<"comment_on_followed">;
}) {
  void notification;
  return (
    <p className="text-sm text-[var(--color-fg-base)]">
      <span className="font-medium">Someone</span> commented on a task you follow.
    </p>
  );
}
