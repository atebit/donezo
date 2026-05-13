"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/empty-states/EmptyState";
import { Button } from "@/components/ui/button";
import { IconLayers } from "@/lib/icons";

// ---------------------------------------------------------------------------
// NoGroupsEmptyState
// ---------------------------------------------------------------------------

interface NoGroupsEmptyStateProps {
  onAddGroup: () => void;
}

export function NoGroupsEmptyState({ onAddGroup }: NoGroupsEmptyStateProps) {
  const t = useTranslations("empty.noGroups");
  return (
    <EmptyState
      icon={IconLayers}
      title={t("title")}
      description={t("description")}
      action={<Button onClick={onAddGroup}>{t("addGroup")}</Button>}
    />
  );
}

// ---------------------------------------------------------------------------
// NoTasksInGroupHint
// ---------------------------------------------------------------------------

export function NoTasksInGroupHint() {
  return (
    <div className="px-4 py-2 text-sm text-[color:var(--color-fg-muted)]">
      No tasks yet — add one below.
    </div>
  );
}
