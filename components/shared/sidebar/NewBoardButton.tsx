"use client";

import { Dialog } from "@base-ui/react";
import { IconPlus } from "@/lib/icons";

// TODO: Slice 11 wires CreateBoardModal here
export function NewBoardButton() {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label="Create new board"
        className="flex items-center justify-center rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        style={{
          width: 28,
          height: 28,
          color: "var(--color-fg-muted)",
        }}
      >
        <span
          className="flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-hover)] transition-colors"
          style={{ width: 28, height: 28 }}
        >
          <IconPlus size={16} aria-hidden="true" />
        </span>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "var(--color-overlay)",
            zIndex: "var(--z-overlay)",
          }}
        />
        <Dialog.Popup
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: "var(--z-modal)",
            backgroundColor: "var(--color-surface)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-modal)",
            padding: "24px",
            minWidth: 360,
            maxWidth: 480,
          }}
        >
          <Dialog.Title
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "var(--color-fg-strong)",
              marginBottom: 8,
            }}
          >
            Create board
          </Dialog.Title>
          <Dialog.Description
            style={{
              fontSize: 14,
              color: "var(--color-fg-muted)",
              marginBottom: 24,
            }}
          >
            Create board (coming in Stage 4)
          </Dialog.Description>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Dialog.Close
              style={{
                padding: "8px 16px",
                backgroundColor: "var(--color-surface-hover)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                fontSize: 14,
                fontWeight: 500,
                color: "var(--color-fg)",
                cursor: "pointer",
              }}
            >
              Close
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
