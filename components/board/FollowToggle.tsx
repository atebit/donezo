"use client";

/**
 * components/board/FollowToggle.tsx
 *
 * Small toggle button for following/unfollowing a task.
 * Mounted in the task drawer header.
 *
 * - Reads initial follow state from a `isFollowing` prop (loaded server-side).
 * - Toggles via followTask / unfollowTask server actions.
 * - Shows current state clearly with icon + text.
 */

import { Bell, BellOff } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { followTask, unfollowTask } from "@/app/(app)/notifications/actions";
import { Button } from "@/components/ui/button";

type Props = {
  taskId: string;
  initialFollowing: boolean;
};

export function FollowToggle({ taskId, initialFollowing }: Props) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const nextValue = !isFollowing;
    setIsFollowing(nextValue); // optimistic

    startTransition(async () => {
      try {
        const action = nextValue ? followTask : unfollowTask;
        const result = await action({ taskId });
        if (!result.ok) {
          setIsFollowing(!nextValue); // revert
          toast.error(result.error.message);
        }
      } catch {
        setIsFollowing(!nextValue); // revert
        toast.error("Failed to update follow state.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
      aria-label={isFollowing ? "Unfollow task" : "Follow task"}
      aria-pressed={isFollowing}
      title={isFollowing ? "Unfollow" : "Follow"}
    >
      {isFollowing ? (
        <>
          <BellOff size={14} aria-hidden />
          <span className="ml-1.5">Following</span>
        </>
      ) : (
        <>
          <Bell size={14} aria-hidden />
          <span className="ml-1.5">Follow</span>
        </>
      )}
    </Button>
  );
}
