"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteWorkspace } from "./actions";

interface DeleteWorkspaceModalProps {
  workspaceId: string;
  workspaceName: string;
}

export function DeleteWorkspaceModal({ workspaceId, workspaceName }: DeleteWorkspaceModalProps) {
  const [open, setOpen] = useState(false);
  const [confirmValue, setConfirmValue] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const isMatch = confirmValue === workspaceName;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setConfirmValue("");
  }

  function handleConfirm() {
    if (!isMatch) return;
    startTransition(async () => {
      const result = await deleteWorkspace({ workspaceId, confirmName: confirmValue });
      if (result.ok) {
        toast.success("Workspace deleted.");
        router.push("/");
      } else {
        toast.error(result.error.message);
        setOpen(false);
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger
        render={
          <Button
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
          >
            Delete workspace
          </Button>
        }
      />
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-50 bg-[color:var(--color-overlay)]"
          style={{ backdropFilter: "blur(2px)" }}
        />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl bg-surface p-6 shadow-[var(--shadow-modal)] focus:outline-none"
          aria-labelledby="delete-workspace-title"
        >
          <Dialog.Title
            id="delete-workspace-title"
            className="mb-2 text-lg font-semibold text-[color:var(--color-fg-strong)]"
          >
            Delete workspace
          </Dialog.Title>
          <Dialog.Description className="mb-5 text-sm text-[color:var(--color-fg-muted)]">
            This action is permanent and cannot be undone. All boards, tasks, and data in{" "}
            <strong className="text-[color:var(--color-fg)]">{workspaceName}</strong> will be
            deleted.
          </Dialog.Description>

          <div className="flex flex-col gap-1.5 mb-6">
            <Label htmlFor="confirm-name">
              Type <strong>{workspaceName}</strong> to confirm
            </Label>
            <Input
              id="confirm-name"
              ref={inputRef}
              type="text"
              value={confirmValue}
              onChange={(e) => setConfirmValue(e.target.value)}
              placeholder={workspaceName}
              aria-describedby="delete-workspace-title"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Dialog.Close
              render={
                <Button variant="outline" disabled={pending}>
                  Cancel
                </Button>
              }
            />
            <Button variant="destructive" disabled={!isMatch || pending} onClick={handleConfirm}>
              {pending ? "Deleting…" : "Delete workspace"}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
