"use client";

import { Dialog } from "@base-ui/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteBoard, restoreBoard } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/actions";

type ArchivedBoard = {
  id: string;
  name: string;
  deleted_at: string | null;
  workspace_id: string;
  created_by: string | null;
};

type Role = "owner" | "admin" | "member" | "viewer";

type TrashListProps = {
  boards: ArchivedBoard[];
  workspaceId: string;
  role: Role;
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  if (diffWeek < 5) return `${diffWeek} week${diffWeek === 1 ? "" : "s"} ago`;
  if (diffMonth < 12) return `${diffMonth} month${diffMonth === 1 ? "" : "s"} ago`;
  return `${diffYear} year${diffYear === 1 ? "" : "s"} ago`;
}

type DeleteDialogProps = {
  board: ArchivedBoard;
  onDeleted: (boardId: string) => void;
};

function DeleteDialog({ board, onDeleted }: DeleteDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [pending, startTransition] = useTransition();

  function handleOpen() {
    setConfirmName("");
    setOpen(true);
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteBoard({ boardId: board.id, confirmName });
      if (result.ok) {
        setOpen(false);
        onDeleted(board.id);
        toast.error(`"${board.name}" permanently deleted.`);
      } else {
        toast.error(result.error.message);
      }
    });
  }

  const canSubmit = confirmName === board.name && !pending;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        style={{
          padding: "5px 12px",
          backgroundColor: "transparent",
          border: "1px solid var(--color-destructive)",
          borderRadius: "var(--radius-sm, 6px)",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--color-destructive)",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Delete permanently
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
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
              borderRadius: 8,
              boxShadow: "var(--shadow-modal)",
              width: 460,
              padding: "24px 28px 28px",
            }}
          >
            <Dialog.Title
              style={{
                fontSize: 20,
                fontWeight: 500,
                color: "var(--color-fg-strong)",
                marginBottom: 12,
              }}
            >
              Permanently delete &ldquo;{board.name}&rdquo;?
            </Dialog.Title>

            <p
              style={{
                fontSize: 14,
                color: "var(--color-fg-muted)",
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              This action <strong>cannot be undone</strong>. All data in this board will be
              permanently destroyed.
            </p>

            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="confirm-board-name"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-fg)",
                  marginBottom: 6,
                }}
              >
                Type <strong>{board.name}</strong> to confirm:
              </label>
              <input
                id="confirm-board-name"
                type="text"
                autoComplete="off"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={board.name}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid var(--color-border-solid)",
                  borderRadius: "var(--radius-sm, 6px)",
                  fontSize: 14,
                  color: "var(--color-fg)",
                  backgroundColor: "var(--color-surface)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <Dialog.Close
                type="button"
                disabled={pending}
                style={{
                  padding: "7px 16px",
                  backgroundColor: "var(--color-surface-hover)",
                  border: "1px solid var(--color-border-solid)",
                  borderRadius: "var(--radius-sm, 6px)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--color-fg)",
                  cursor: pending ? "not-allowed" : "pointer",
                  opacity: pending ? 0.6 : 1,
                }}
              >
                Cancel
              </Dialog.Close>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleDelete}
                style={{
                  padding: "7px 16px",
                  backgroundColor: "var(--color-destructive)",
                  border: "none",
                  borderRadius: "var(--radius-sm, 6px)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "white",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  opacity: canSubmit ? (pending ? 0.7 : 1) : 0.4,
                }}
              >
                {pending ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

export function TrashList({ boards, workspaceId: _workspaceId, role }: TrashListProps) {
  const router = useRouter();
  const [rows, setRows] = useState(boards);
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());

  function removeRow(boardId: string) {
    setRows((prev) => prev.filter((b) => b.id !== boardId));
  }

  async function handleRestore(boardId: string) {
    setRestoringIds((prev) => new Set(prev).add(boardId));
    const result = await restoreBoard({ boardId });
    setRestoringIds((prev) => {
      const next = new Set(prev);
      next.delete(boardId);
      return next;
    });
    if (result.ok) {
      removeRow(boardId);
      router.refresh();
    } else {
      toast.error(result.error.message);
    }
  }

  if (rows.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 0",
          gap: 8,
          color: "var(--color-fg-muted)",
        }}
      >
        <p style={{ fontSize: 14 }}>No archived boards.</p>
      </div>
    );
  }

  return (
    <table
      aria-label="Archived boards"
      style={{
        width: "100%",
        borderCollapse: "collapse",
        border: "1px solid var(--color-border-solid)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <thead>
        <tr
          style={{
            backgroundColor: "var(--color-surface-row-hover)",
            borderBottom: "1px solid var(--color-border-solid)",
          }}
        >
          <th
            scope="col"
            style={{
              textAlign: "left",
              padding: "10px 16px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-fg-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Board
          </th>
          <th
            scope="col"
            style={{
              textAlign: "left",
              padding: "10px 16px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-fg-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              width: 160,
            }}
          >
            Archived
          </th>
          <th
            scope="col"
            style={{
              width: role === "owner" ? 240 : 90,
              padding: "10px 16px",
            }}
          />
        </tr>
      </thead>
      <tbody>
        {rows.map((board) => {
          const isRestoring = restoringIds.has(board.id);
          const archivedAt = board.deleted_at ?? "";

          return (
            <tr
              key={board.id}
              style={{
                borderBottom: "1px solid var(--color-border-solid)",
                backgroundColor: "var(--color-surface)",
              }}
            >
              <td
                style={{
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--color-fg)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 0,
                }}
              >
                {board.name}
              </td>
              <td
                style={{
                  padding: "12px 16px",
                  fontSize: 13,
                  color: "var(--color-fg-muted)",
                  whiteSpace: "nowrap",
                }}
                title={archivedAt ? new Date(archivedAt).toLocaleString() : undefined}
              >
                {archivedAt ? relativeTime(archivedAt) : "—"}
              </td>
              <td
                style={{
                  padding: "12px 16px",
                  textAlign: "right",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    type="button"
                    disabled={isRestoring}
                    onClick={() => handleRestore(board.id)}
                    style={{
                      padding: "5px 12px",
                      backgroundColor: "var(--color-primary)",
                      border: "none",
                      borderRadius: "var(--radius-sm, 6px)",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "white",
                      cursor: isRestoring ? "not-allowed" : "pointer",
                      opacity: isRestoring ? 0.6 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isRestoring ? "Restoring…" : "Restore"}
                  </button>

                  {role === "owner" && <DeleteDialog board={board} onDeleted={removeRow} />}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
