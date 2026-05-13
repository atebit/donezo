"use client";

/**
 * Person OperandEditor — compact filter operand input for the "person" cell type.
 *
 * For `equals` and `in` (and `not_in`): renders a member list with avatar + name.
 * Selection emits:
 *   - "equals": { userIds: [id] } (single selection)
 *   - "in" / "not_in": string[] of user IDs
 *
 * Members are passed via the optional `members` prop from OperandInput.
 * When absent, an empty list is shown.
 *
 * compact: true is required by the CellTypeDef.OperandEditor contract.
 */

import { useState } from "react";
import { Avatar } from "@/components/shared/Avatar";
import type { Member } from "@/components/shared/MemberStack";
import type { FilterOperator } from "@/lib/cells/types";
import type { PersonCellValue } from "./def";

interface PersonOperandEditorProps {
  value: unknown;
  config: Record<string, never>;
  op: FilterOperator;
  compact: true;
  onChange: (next: unknown) => void;
  onClose: () => void;
  /** Member roster injected by the filter orchestrator. */
  members?: Member[];
}

export function OperandEditor({
  value,
  op,
  onChange,
  members = [],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config: _config,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onClose: _onClose,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  compact: _compact,
}: PersonOperandEditorProps) {
  const [query, setQuery] = useState("");

  const filtered = members.filter((m) => {
    const name = (m.displayName ?? m.email ?? "").toLowerCase();
    return name.includes(query.toLowerCase());
  });

  const isMulti = op === "in" || op === "not_in";

  // Derive selected IDs from value
  const selectedIds: string[] = isMulti
    ? Array.isArray(value)
      ? (value as string[])
      : []
    : (() => {
        const pv = value as PersonCellValue | null;
        return pv?.userIds ?? [];
      })();

  const toggle = (userId: string) => {
    const next = new Set(selectedIds);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    const arr = Array.from(next);

    if (isMulti) {
      onChange(arr);
    } else {
      // equals / not_equals: wrap in PersonCellValue shape
      onChange(arr.length > 0 ? { userIds: arr } : null);
    }
  };

  return (
    <div
      className="flex flex-col py-1"
      style={{ minWidth: 180 }}
      role="listbox"
      aria-multiselectable={isMulti}
      aria-label="Select members"
    >
      {/* Search input */}
      <div className="px-2 pb-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          aria-label="Search members"
          className="w-full rounded border border-[color:var(--color-border-strong)] px-2 py-1 text-xs text-[color:var(--color-fg)] bg-[color:var(--color-surface)] placeholder:text-[color:var(--color-fg-muted)] outline-none focus:border-[color:var(--color-primary)] transition-colors"
        />
      </div>

      {/* Member list */}
      <div className="max-h-36 overflow-y-auto flex flex-col">
        {filtered.length === 0 && (
          <p className="px-2 py-1 text-xs text-[color:var(--color-fg-muted)]">No members found.</p>
        )}
        {filtered.map((member) => {
          const isSelected = selectedIds.includes(member.id);
          return (
            <button
              key={member.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => toggle(member.id)}
              className="flex items-center gap-2 px-2 py-1 text-xs text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] cursor-pointer transition-colors text-left"
              style={isSelected ? { backgroundColor: "var(--color-primary-selected)" } : undefined}
            >
              <Avatar
                src={member.avatarUrl}
                displayName={member.displayName}
                email={member.email}
                size={22}
              />
              <span className="truncate flex-1">
                {member.displayName ?? member.email ?? "Unknown"}
              </span>
              {isSelected && (
                <svg
                  aria-hidden="true"
                  width={12}
                  height={12}
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[color:var(--color-primary)] shrink-0"
                >
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
