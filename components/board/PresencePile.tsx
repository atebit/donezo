"use client";

import { Tooltip } from "@base-ui/react";

import { Avatar } from "@/components/shared/Avatar";
import { selectPresentUserIds, useBoardStore } from "@/stores/board-store";

interface PresencePileProps {
  members: Array<{
    id: string;
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  }>;
  currentUserId: string;
  max?: number; // default 4 (matches existing MemberStack default)
}

/**
 * PresencePile — shows live-now avatars with a green dot for users currently
 * viewing this board. Deduped per user (multi-tab aware). Current user excluded.
 *
 * Epic 08: Realtime & Presence
 */
export function PresencePile({ members, currentUserId, max = 4 }: PresencePileProps) {
  const presentIds = useBoardStore(selectPresentUserIds);

  // Exclude the current user from the displayed pile
  const othersPresent = presentIds.filter((id) => id !== currentUserId);

  const memberMap = new Map(members.map((m) => [m.id, m]));

  const visible = othersPresent.slice(0, max);
  const surplus = othersPresent.length - visible.length;

  if (othersPresent.length === 0) return null;

  return (
    // biome-ignore lint/a11y/useSemanticElements: span role="group" is correct for a presentational avatar stack
    <span
      role="group"
      data-testid="presence-pile"
      className="inline-flex items-center"
      aria-label={`${othersPresent.length} user${othersPresent.length !== 1 ? "s" : ""} viewing this board`}
    >
      <Tooltip.Provider delay={200}>
        {visible.map((userId, index) => {
          const member = memberMap.get(userId);
          const displayName = member?.displayName ?? null;
          const email = member?.email ?? null;
          const avatarUrl = member?.avatarUrl ?? null;
          const label = displayName ?? email ?? "Unknown user";

          return (
            <Tooltip.Root key={userId}>
              <Tooltip.Trigger
                render={
                  <span
                    data-testid="presence-avatar"
                    style={index === 0 ? undefined : { marginLeft: -8 }}
                    className="relative inline-flex shrink-0"
                  />
                }
              >
                <Avatar
                  src={avatarUrl}
                  displayName={displayName}
                  email={email}
                  size={24}
                  borderColor="white"
                />
                {/* Green presence dot — 8px at bottom-right */}
                {/* TODO: map to --color-success once token is defined in design-system.md */}
                <span
                  aria-hidden
                  className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-500 ring-1 ring-white"
                />
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner sideOffset={4}>
                  <Tooltip.Popup className="rounded-md bg-[color:var(--color-fg-strong)] px-2 py-1 text-xs text-white shadow-sm z-[var(--z-popover)]">
                    {label}
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          );
        })}
        {surplus > 0 && (
          // biome-ignore lint/a11y/useAriaPropsSupportedByRole: surplus count chip uses aria-label for screen reader clarity
          <span
            aria-label={`${surplus} more user${surplus !== 1 ? "s" : ""} viewing`}
            style={{
              width: 24,
              height: 24,
              marginLeft: -8,
              fontSize: 11,
              border: "1.6px solid white",
              color: "var(--color-fg)",
              backgroundColor: "white",
            }}
            className="inline-flex items-center justify-center rounded-full shrink-0 font-medium leading-none select-none"
          >
            +{surplus}
          </span>
        )}
      </Tooltip.Provider>
    </span>
  );
}
