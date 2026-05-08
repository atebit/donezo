"use client";

import { useState } from "react";
import { CreateBoardModal } from "@/components/shared/CreateBoardModal";
import { IconPlus } from "@/lib/icons";

export function NewBoardButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Create new board"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        style={{
          width: 28,
          height: 28,
          color: "var(--color-fg-muted)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <span
          className="flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-hover)] transition-colors"
          style={{ width: 28, height: 28 }}
        >
          <IconPlus size={16} aria-hidden="true" />
        </span>
      </button>
      <CreateBoardModal open={open} onOpenChange={setOpen} />
    </>
  );
}
