"use client";

import { useTranslations } from "next-intl";
import { IconLayout } from "@/lib/icons";
import { EmptyState } from "./EmptyState";

type NoBoardsInWorkspaceProps = {
  onCreate?: () => void;
};

export function NoBoardsInWorkspace({ onCreate }: NoBoardsInWorkspaceProps) {
  const t = useTranslations("empty.noBoards");

  return (
    <EmptyState
      icon={IconLayout}
      title={t("title")}
      description={t("description")}
      action={
        onCreate ? (
          <button
            type="button"
            onClick={onCreate}
            className="px-5 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Create board
          </button>
        ) : undefined
      }
    />
  );
}
