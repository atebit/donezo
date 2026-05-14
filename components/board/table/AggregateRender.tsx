"use client";

/**
 * AggregateRender — renders a structured AggregateRenderDescriptor from a
 * group footer cell into the appropriate visual.
 *
 * Descriptor kinds:
 *   "text"                 → plain text span
 *   "count_non_empty"      → "N / M" fraction text
 *   "label_distribution"   → stacked proportional colored bar
 *   "date_range"           → date-range pill text ("min – max")
 *   "percent_checked"      → percentage text ("58%")
 *   "unique_count_avatars" → avatar stack (up to 3) + overflow chip + count
 *
 * Epic 16 (Slice C): initial implementation.
 * Epic 16 (Slice C-1): replace unique_count_avatars count-only with avatar stack.
 */

import { Avatar } from "@/components/shared/Avatar";
import type { AggregateRenderDescriptor } from "@/lib/cells/aggregate-descriptors";

interface AggregateRenderProps {
  descriptor: AggregateRenderDescriptor;
}

export function AggregateRender({ descriptor }: AggregateRenderProps) {
  switch (descriptor.kind) {
    case "text":
      return (
        <span className="text-[13px] font-medium text-[color:var(--color-fg)]">
          {descriptor.value}
        </span>
      );

    case "count_non_empty":
      return (
        <span className="text-[13px] font-medium text-[color:var(--color-fg)] tabular-nums">
          {descriptor.nonEmpty}
          <span className="text-[color:var(--color-fg-muted)]"> / {descriptor.total}</span>
        </span>
      );

    case "label_distribution": {
      const { segments } = descriptor;
      if (segments.length === 0) {
        return <span className="text-[13px] text-[color:var(--color-fg-muted)]">—</span>;
      }
      const total = segments.reduce((s, seg) => s + seg.count, 0);
      return (
        <div
          className="flex h-2 w-full rounded-full overflow-hidden"
          role="img"
          aria-label={segments
            .map((s) => `${s.name}: ${Math.round((s.count / total) * 100)}%`)
            .join(", ")}
        >
          {segments.map((seg) => {
            const pct = (seg.count / total) * 100;
            return (
              <div
                key={seg.labelId}
                className="h-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: seg.color,
                  minWidth: pct > 0 ? 2 : 0,
                }}
                title={`${seg.name}: ${Math.round(pct)}%`}
              />
            );
          })}
        </div>
      );
    }

    case "date_range": {
      const { min, max } = descriptor;
      if (min == null && max == null) {
        return <span className="text-[13px] text-[color:var(--color-fg-muted)]">—</span>;
      }
      const fmt = new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const minStr = min ? fmt.format(new Date(min)) : "—";
      const maxStr = max ? fmt.format(new Date(max)) : "—";
      const label = min === max ? minStr : `${minStr} – ${maxStr}`;
      return (
        <span className="text-[13px] font-medium text-[color:var(--color-fg)] truncate">
          {label}
        </span>
      );
    }

    case "percent_checked": {
      const { pct, total } = descriptor;
      if (total === 0) {
        return <span className="text-[13px] text-[color:var(--color-fg-muted)]">—</span>;
      }
      return (
        <span className="text-[13px] font-medium text-[color:var(--color-fg)] tabular-nums">
          {Math.round(pct)}%
        </span>
      );
    }

    case "unique_count_avatars": {
      const { count, userIds } = descriptor;

      // Empty state: muted em-dash, no avatar stack.
      if (count === 0) {
        return <span className="text-[13px] text-[color:var(--color-fg-muted)]">—</span>;
      }

      // Show up to 3 avatars, then a +N overflow chip, then the total count.
      // Profile data is not available in the group footer (no store slice for
      // board member profiles), so Avatar falls back to initial-letter rendering
      // derived from the userId string (first character, uppercased).
      const MAX_VISIBLE = 3;
      const visibleIds = userIds.slice(0, MAX_VISIBLE);
      const overflow = userIds.length > MAX_VISIBLE ? userIds.length - MAX_VISIBLE : 0;
      // Overlap distance between avatars (negative margin-left on subsequent items).
      const OVERLAP = -6;
      const AVATAR_SIZE = 20;

      return (
        <div
          className="flex items-center gap-1"
          role="img"
          aria-label={`${count} ${count === 1 ? "person" : "people"}`}
        >
          {/* Avatar stack */}
          <span className="inline-flex items-center">
            {visibleIds.map((userId, index) => (
              <span
                key={userId}
                aria-hidden="true"
                style={index === 0 ? undefined : { marginLeft: OVERLAP }}
                className="inline-flex"
              >
                <Avatar
                  // No profile data available in the footer; derive an initial
                  // from the userId so Avatar shows a letter rather than "?".
                  displayName={userId.slice(0, 1).toUpperCase()}
                  size={AVATAR_SIZE}
                  borderColor="white"
                />
              </span>
            ))}

            {/* +N overflow chip when more than MAX_VISIBLE unique users */}
            {overflow > 0 && (
              <span
                aria-hidden="true"
                style={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  marginLeft: OVERLAP,
                  fontSize: 10,
                  border: "1.6px solid white",
                  color: "var(--color-fg)",
                  backgroundColor: "var(--color-surface-hover)",
                }}
                className="inline-flex items-center justify-center rounded-full shrink-0 font-medium leading-none select-none"
              >
                +{overflow}
              </span>
            )}
          </span>

          {/* Total count to the right of the avatar stack */}
          <span className="text-[13px] font-medium text-[color:var(--color-fg-muted)] tabular-nums">
            {count}
          </span>
        </div>
      );
    }

    default:
      // Exhaustiveness check — TypeScript will error if a new kind is added without a case.
      descriptor satisfies never;
      return null;
  }
}
