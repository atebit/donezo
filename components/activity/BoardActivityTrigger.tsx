"use client";

import { useMemo, useState } from "react";
import { BoardActivityModal } from "@/components/activity/BoardActivityModal";
import type {
  ActivityRenderCtx,
  ColumnRow,
  ProfileRow,
} from "@/components/activity/renderers";
import { IconHistory } from "@/lib/icons";
import { useBoardStore } from "@/stores/board-store";

interface BoardActivityTriggerProps {
  members: Array<{
    id: string;
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  }>;
}

export function BoardActivityTrigger({ members }: BoardActivityTriggerProps) {
  const [open, setOpen] = useState(false);

  const columnsArr = useBoardStore((s) => s.columns);
  const labelsByColumn = useBoardStore((s) => s.labelsByColumn);

  const ctx: ActivityRenderCtx = useMemo(() => {
    const columns = new Map<string, ColumnRow>();
    for (const c of columnsArr) columns.set(c.id, c);

    // Build a partial ProfileRow per known member (sufficient for resolveActor +
    // ActivityItem avatar). Unknown fields default to null / synthetic values to
    // satisfy ProfileRow's required shape without inventing data.
    const profiles = new Map<string, ProfileRow>();
    for (const m of members) {
      profiles.set(m.id, {
        id: m.id,
        display_name: m.displayName,
        email: m.email,
        avatar_url: m.avatarUrl,
        // Required-by-type but unused in renderers — safe synthetic values.
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
        last_workspace_id: null,
      });
    }

    return { columns, labelsByColumn, profiles };
  }, [columnsArr, labelsByColumn, members]);

  return (
    <>
      <button
        type="button"
        aria-label="View board activity"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]"
      >
        <IconHistory size={14} />
        Activity
      </button>

      <BoardActivityModal
        open={open}
        onOpenChange={setOpen}
        ctx={ctx}
        members={members.map((m) => ({ id: m.id, displayName: m.displayName, email: m.email }))}
      />
    </>
  );
}
