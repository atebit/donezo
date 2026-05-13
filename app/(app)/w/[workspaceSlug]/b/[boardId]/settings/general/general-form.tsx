"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { renameBoard } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/actions";
import {
  setBoardPrivacy,
  updateBoardDescription,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/settings/general/actions";
import { BoardArchiveConfirmModal } from "@/components/board/BoardArchiveConfirmModal";
import { BoardDeleteConfirmModal } from "@/components/board/BoardDeleteConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Role } from "@/lib/authorization";
import {
  type RenameBoardInput,
  RenameBoardSchema,
  type UpdateBoardDescriptionInput,
  UpdateBoardDescriptionSchema,
} from "@/lib/validations/board";

interface BoardGeneralFormProps {
  boardId: string;
  boardName: string;
  boardDescription: string;
  boardIsPrivate: boolean;
  workspaceSlug: string;
  boardRole: Role;
  workspaceRole: Role | null;
}

// ── Rename section ────────────────────────────────────────────────────────────

function RenameSection({ boardId, boardName }: { boardId: string; boardName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RenameBoardInput>({
    resolver: zodResolver(RenameBoardSchema),
    defaultValues: { boardId, name: boardName },
  });

  function onSubmit(values: RenameBoardInput) {
    startTransition(async () => {
      const result = await renameBoard(values);
      if (result.ok) {
        toast.success("Board renamed.");
        router.refresh();
      } else if (result.error.field) {
        setError(result.error.field as keyof RenameBoardInput, {
          message: result.error.message,
        });
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <section
      aria-labelledby="rename-board-heading"
      className="rounded-xl border border-[color:var(--color-border)] bg-surface p-6"
    >
      <h2
        id="rename-board-heading"
        className="mb-4 text-base font-semibold text-[color:var(--color-fg-strong)]"
      >
        Board name
      </h2>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <input type="hidden" {...register("boardId")} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="board-name">Name</Label>
          <Input
            id="board-name"
            type="text"
            autoComplete="off"
            required
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "board-settings-name-error" : undefined}
            {...register("name")}
          />
          {errors.name && (
            <p id="board-settings-name-error" className="text-sm text-destructive" role="alert">
              {errors.name.message}
            </p>
          )}
        </div>
        <div>
          <Button type="submit" disabled={pending} size="sm">
            {pending ? "Saving…" : "Save name"}
          </Button>
        </div>
      </form>
    </section>
  );
}

// ── Description section ───────────────────────────────────────────────────────

function DescriptionSection({
  boardId,
  boardDescription,
}: {
  boardId: string;
  boardDescription: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateBoardDescriptionInput>({
    resolver: zodResolver(UpdateBoardDescriptionSchema),
    defaultValues: { boardId, description: boardDescription },
  });

  function onSubmit(values: UpdateBoardDescriptionInput) {
    startTransition(async () => {
      const result = await updateBoardDescription(values);
      if (result.ok) {
        toast.success("Description updated.");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <section
      aria-labelledby="desc-board-heading"
      className="rounded-xl border border-[color:var(--color-border)] bg-surface p-6"
    >
      <h2
        id="desc-board-heading"
        className="mb-4 text-base font-semibold text-[color:var(--color-fg-strong)]"
      >
        Description
      </h2>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <input type="hidden" {...register("boardId")} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="board-description">Description</Label>
          <textarea
            id="board-description"
            rows={4}
            autoComplete="off"
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? "board-settings-desc-error" : undefined}
            className="w-full rounded-md border border-[color:var(--color-border-strong)] bg-surface px-3 py-2 text-sm text-[color:var(--color-fg)] placeholder:text-[color:var(--color-fg-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)] resize-y disabled:opacity-50"
            placeholder="Add a short description for this board…"
            {...register("description")}
          />
          {errors.description && (
            <p id="board-settings-desc-error" className="text-sm text-destructive" role="alert">
              {errors.description.message}
            </p>
          )}
        </div>
        <div>
          <Button type="submit" disabled={pending} size="sm">
            {pending ? "Saving…" : "Save description"}
          </Button>
        </div>
      </form>
    </section>
  );
}

// ── Privacy section ───────────────────────────────────────────────────────────

function PrivacySection({ boardId, boardIsPrivate }: { boardId: string; boardIsPrivate: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const goingPrivate = !boardIsPrivate;

    if (goingPrivate) {
      // Going public → private: warn about hiding from workspace members
      const confirmed = window.confirm(
        "Making this board private will hide it from workspace members who aren't invited. Continue?",
      );
      if (!confirmed) return;
    } else {
      // Going private → public: warn about making visible
      const confirmed = window.confirm(
        "This will make the board visible to all workspace members. Continue?",
      );
      if (!confirmed) return;
    }

    startTransition(async () => {
      const result = await setBoardPrivacy({ boardId, isPrivate: goingPrivate });
      if (result.ok) {
        toast.success(goingPrivate ? "Board is now private." : "Board is now public.");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <section
      aria-labelledby="privacy-board-heading"
      className="rounded-xl border border-[color:var(--color-border)] bg-surface p-6"
    >
      <h2
        id="privacy-board-heading"
        className="mb-2 text-base font-semibold text-[color:var(--color-fg-strong)]"
      >
        Privacy
      </h2>
      <p className="mb-4 text-sm text-[color:var(--color-fg-muted)]">
        {boardIsPrivate
          ? "This board is private. Only invited members can see it."
          : "This board is visible to all workspace members."}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={handleToggle} disabled={pending}>
        {pending ? "Updating…" : boardIsPrivate ? "Make public" : "Make private"}
      </Button>
    </section>
  );
}

// ── Danger zone ───────────────────────────────────────────────────────────────

function DangerZone({
  workspaceSlug,
  workspaceRole,
}: {
  workspaceSlug: string;
  workspaceRole: Role | null;
}) {
  const router = useRouter();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <section
      aria-labelledby="danger-board-heading"
      className="rounded-xl border border-destructive/30 bg-surface p-6"
    >
      <h2 id="danger-board-heading" className="mb-2 text-base font-semibold text-destructive">
        Danger zone
      </h2>
      <div className="flex flex-col gap-4">
        {/* Archive — admin+ */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[color:var(--color-fg)]">Archive board</p>
            <p className="text-sm text-[color:var(--color-fg-muted)]">
              Move this board to the trash. You can restore it later.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setArchiveOpen(true)}
            className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            Archive
          </Button>
        </div>

        {/* Permanent delete — workspace-owner only */}
        {workspaceRole === "owner" ? (
          <div className="flex items-center justify-between gap-4 border-t border-[color:var(--color-border)] pt-4">
            <div>
              <p className="text-sm font-medium text-[color:var(--color-fg)]">
                Delete board permanently
              </p>
              <p className="text-sm text-[color:var(--color-fg-muted)]">
                Permanently delete this board and all its data. This cannot be undone.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              Delete permanently
            </Button>
          </div>
        ) : null}
      </div>

      <BoardArchiveConfirmModal
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        onSuccess={() => router.push(`/w/${workspaceSlug}`)}
      />
      <BoardDeleteConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onSuccess={() => router.push(`/w/${workspaceSlug}`)}
      />
    </section>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function BoardGeneralForm({
  boardId,
  boardName,
  boardDescription,
  boardIsPrivate,
  workspaceSlug,
  workspaceRole,
}: BoardGeneralFormProps) {
  return (
    <div className="flex flex-col gap-6">
      <RenameSection boardId={boardId} boardName={boardName} />
      <DescriptionSection boardId={boardId} boardDescription={boardDescription} />
      <PrivacySection boardId={boardId} boardIsPrivate={boardIsPrivate} />
      <DangerZone workspaceSlug={workspaceSlug} workspaceRole={workspaceRole} />
    </div>
  );
}
