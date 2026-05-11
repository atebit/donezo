"use client";

/**
 * PersonEditor — popover-content editor for the "person" cell type.
 *
 * Renders inside a Base UI <Popover> managed by the orchestrator (S15).
 * This component is the popover CONTENT only — no <Popover.Root> here.
 *
 * Layout:
 *   - Search input at the top
 *   - Scrollable list of members with avatar + name; clicking toggles inclusion
 *   - "Clear" chip at bottom
 *
 * Members:
 *   Received via the optional `members` prop passed by the orchestrator (S15).
 *   When the prop is absent, an empty list is shown (same pattern as
 *   StatusLabelEditor's optional `columnId` prop).
 *
 * Contract:
 *   - NO Supabase imports. NO server-action calls.
 *   - Emit onChange(next) + onClose() when a selection is committed.
 *   - Esc closes without commit (handled by the orchestrator's Popover).
 */

import { useState } from "react";

import { Avatar } from "@/components/shared/Avatar";
import type { Member } from "@/components/shared/MemberStack";

import type { PersonCellValue } from "./def";

interface PersonEditorProps {
  value: PersonCellValue | null;
  config: Record<string, never>;
  onChange: (next: PersonCellValue | null) => void;
  onClose: () => void;
  /**
   * Workspace/board member roster provided by the orchestrator (S15).
   * When absent, the editor shows an empty list.
   */
  members?: Member[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Editor({
  value,
  config: _config,
  onChange,
  onClose,
  members = [],
}: PersonEditorProps) {
  const [query, setQuery] = useState("");
  const selected = new Set(value?.userIds ?? []);

  const filtered = members.filter((m) => {
    const name = (m.displayName ?? m.email ?? "").toLowerCase();
    return name.includes(query.toLowerCase());
  });

  const toggle = (userId: string) => {
    const next = new Set(selected);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    const userIds = Array.from(next);
    onChange(userIds.length > 0 ? { userIds } : null);
  };

  const handleClear = () => {
    onChange(null);
    onClose();
  };

  return (
    <div
      className="flex flex-col py-2"
      style={{ width: 220 }}
      role="listbox"
      aria-label="Select members"
      aria-multiselectable="true"
    >
      {/* Search input */}
      <div className="px-2 pb-1">
        <input
          // biome-ignore lint/a11y/noAutofocus: cell editor intentionally claims focus when opened by the orchestrator
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members…"
          aria-label="Search members"
          className="w-full rounded-[var(--radius-xs)] border border-[color:var(--color-border-strong)] px-2 py-1 text-sm text-[color:var(--color-fg)] bg-[color:var(--color-surface)] placeholder:text-[color:var(--color-fg-muted)] outline-none focus:border-[color:var(--color-primary)] transition-colors duration-[var(--motion-fast)]"
        />
      </div>

      {/* Member list */}
      <div className="max-h-48 overflow-y-auto flex flex-col">
        {filtered.length === 0 && (
          <p className="px-3 py-2 text-xs text-[color:var(--color-fg-muted)]">No members found.</p>
        )}
        {filtered.map((member) => {
          const isSelected = selected.has(member.id);
          return (
            <button
              key={member.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => toggle(member.id)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] cursor-pointer transition-colors duration-[var(--motion-fast)] text-left"
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
                  width={14}
                  height={14}
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[color:var(--color-primary)] shrink-0"
                >
                  <polyline points="2 7 5.5 10.5 12 4" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Clear footer */}
      <div className="mt-1 border-t border-[color:var(--color-border-strong)]">
        <button
          type="button"
          onClick={handleClear}
          className="w-full px-3 h-8 text-left text-xs text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] transition-colors duration-[var(--motion-fast)] cursor-pointer"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
