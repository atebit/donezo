"use client";

import type { ActivityFilters } from "@/lib/validations/activity";

const ACTION_GROUPS = [
  { id: "task" as const, label: "Tasks" },
  { id: "group" as const, label: "Groups" },
  { id: "column" as const, label: "Columns" },
  { id: "cell" as const, label: "Cells" },
  { id: "comment" as const, label: "Comments" },
  { id: "label" as const, label: "Labels" },
];

type ActionGroup = (typeof ACTION_GROUPS)[number]["id"];

type Member = {
  id: string;
  displayName: string | null;
  email: string | null;
};

interface BoardActivityFiltersProps {
  value: ActivityFilters;
  onChange: (filters: ActivityFilters) => void;
  /** Board members available to filter by actor. */
  members?: Member[];
}

export function BoardActivityFilters({ value, onChange, members = [] }: BoardActivityFiltersProps) {
  function handleActorChange(memberId: string, checked: boolean) {
    const prev = value.actorIds ?? [];
    const next = checked ? [...prev, memberId] : prev.filter((id) => id !== memberId);
    onChange({ ...value, actorIds: next.length > 0 ? next : undefined });
  }

  function handleGroupChange(group: ActionGroup, checked: boolean) {
    const prev = value.actionGroups ?? [];
    const next = checked ? [...prev, group] : prev.filter((g) => g !== group);
    onChange({ ...value, actionGroups: next.length > 0 ? next : undefined });
  }

  function handleDateFrom(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    // Convert date input value (YYYY-MM-DD) to ISO datetime string
    onChange({ ...value, dateFrom: v ? `${v}T00:00:00.000Z` : undefined });
  }

  function handleDateTo(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange({ ...value, dateTo: v ? `${v}T23:59:59.999Z` : undefined });
  }

  // Convert ISO datetime back to YYYY-MM-DD for the date input
  const dateFromValue = value.dateFrom ? value.dateFrom.slice(0, 10) : "";
  const dateToValue = value.dateTo ? value.dateTo.slice(0, 10) : "";

  return (
    // biome-ignore lint/a11y/useSemanticElements: fieldset would force legend display; role="group" with aria-label is correct for a filter control group
    <div
      role="group"
      aria-label="Activity filters"
      className="flex flex-wrap gap-4 p-3 border-b border-[color:var(--color-border)]"
    >
      {/* Actor multi-select */}
      {members.length > 0 && (
        <div className="flex flex-col gap-1 min-w-[160px]">
          <span className="text-xs font-medium text-[color:var(--color-fg-muted)] uppercase tracking-wide">
            Actor
          </span>
          <div className="flex flex-col gap-0.5 max-h-[120px] overflow-y-auto">
            {members.map((m) => {
              const checked = (value.actorIds ?? []).includes(m.id);
              const label = m.displayName ?? m.email ?? m.id;
              return (
                <label
                  key={m.id}
                  className="flex items-center gap-1.5 cursor-pointer text-sm text-[color:var(--color-fg)] hover:text-[color:var(--color-fg-strong)] py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => handleActorChange(m.id, e.target.checked)}
                    className="accent-[color:var(--color-primary)]"
                    aria-label={`Filter by ${label}`}
                  />
                  <span className="truncate max-w-[120px]">{label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Action group multi-select */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-[color:var(--color-fg-muted)] uppercase tracking-wide">
          Category
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {ACTION_GROUPS.map(({ id, label }) => {
            const checked = (value.actionGroups ?? []).includes(id);
            return (
              <label
                key={id}
                className="flex items-center gap-1.5 cursor-pointer text-sm text-[color:var(--color-fg)] hover:text-[color:var(--color-fg-strong)] py-0.5"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => handleGroupChange(id, e.target.checked)}
                  className="accent-[color:var(--color-primary)]"
                  aria-label={`Filter by ${label}`}
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Date range */}
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="activity-date-from"
            className="text-xs font-medium text-[color:var(--color-fg-muted)] uppercase tracking-wide"
          >
            From
          </label>
          <input
            id="activity-date-from"
            type="date"
            value={dateFromValue}
            onChange={handleDateFrom}
            className="rounded border border-[color:var(--color-border)] px-2 py-1 text-sm text-[color:var(--color-fg)] bg-[color:var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
            aria-label="Filter from date"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="activity-date-to"
            className="text-xs font-medium text-[color:var(--color-fg-muted)] uppercase tracking-wide"
          >
            To
          </label>
          <input
            id="activity-date-to"
            type="date"
            value={dateToValue}
            onChange={handleDateTo}
            className="rounded border border-[color:var(--color-border)] px-2 py-1 text-sm text-[color:var(--color-fg)] bg-[color:var(--color-surface)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
            aria-label="Filter to date"
          />
        </div>
      </div>
    </div>
  );
}
