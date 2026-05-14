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
 *   "unique_count_avatars" → count text (avatar stack is v2 polish)
 *
 * Epic 16 (Slice C): initial implementation.
 */

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
      const { count } = descriptor;
      if (count === 0) {
        return <span className="text-[13px] text-[color:var(--color-fg-muted)]">—</span>;
      }
      return (
        <span className="text-[13px] font-medium text-[color:var(--color-fg)] tabular-nums">
          {count}
        </span>
      );
    }

    default:
      // Exhaustiveness check — TypeScript will error if a new kind is added without a case.
      descriptor satisfies never;
      return null;
  }
}
