"use client";

import { Dialog } from "@base-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { createBoard } from "@/app/(app)/w/[workspaceSlug]/actions";
import { useWorkspace } from "@/hooks/use-workspace";

// Local schema without .default() so input/output types match, avoiding the
// extra cascading TS errors (TS2322/TS2345/TS2339) that arise when Zod 4 schema
// defaults cause input/output type divergence in the @hookform resolver overloads.
// The one TS2769 that remains here is the pre-existing Zod 4 / @hookform compat
// issue — identical in kind to app/(auth)/* and app/(app)/account/* forms.
const FormSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1, "Board name is required").max(120),
  description: z.string().max(5000),
  isPrivate: z.boolean(),
  template: z.enum(["blank"]),
});

type FormValues = z.infer<typeof FormSchema>;

type CreateBoardModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateBoardModal({ open, onOpenChange }: CreateBoardModalProps) {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      workspaceId: workspace.id,
      name: "",
      description: "",
      isPrivate: false,
      template: "blank",
    },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await createBoard(values);
      if (result.ok && result.data) {
        const boardId = (result.data as { id: string }).id;
        reset();
        onOpenChange(false);
        router.push(`/w/${workspace.slug}/b/${boardId}`);
      } else if (!result.ok) {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
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
            width: 500,
            padding: "16px 32px 32px",
          }}
        >
          <Dialog.Title
            style={{
              fontSize: 32,
              fontWeight: 500,
              color: "var(--color-fg-strong)",
              marginBottom: 24,
            }}
          >
            Create board
          </Dialog.Title>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            {/* Hidden workspaceId */}
            <input type="hidden" {...register("workspaceId")} />

            {/* Board name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="board-name"
                style={{ fontSize: 13, fontWeight: 500, color: "var(--color-fg)" }}
              >
                Board name
                <span aria-hidden="true" style={{ color: "var(--color-danger)", marginLeft: 2 }}>
                  *
                </span>
              </label>
              <input
                id="board-name"
                type="text"
                autoComplete="off"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "board-name-error" : undefined}
                style={{
                  padding: "8px 12px",
                  border: "1px solid var(--color-border-solid)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 14,
                  color: "var(--color-fg)",
                  backgroundColor: "var(--color-surface)",
                  outline: "none",
                  width: "100%",
                }}
                {...register("name")}
              />
              {errors.name && (
                <p
                  id="board-name-error"
                  role="alert"
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
                >
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="board-description"
                style={{ fontSize: 13, fontWeight: 500, color: "var(--color-fg)" }}
              >
                Description
              </label>
              <textarea
                id="board-description"
                rows={3}
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? "board-description-error" : undefined}
                style={{
                  padding: "8px 12px",
                  border: "1px solid var(--color-border-solid)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 14,
                  color: "var(--color-fg)",
                  backgroundColor: "var(--color-surface)",
                  outline: "none",
                  resize: "vertical",
                  width: "100%",
                }}
                {...register("description")}
              />
              {errors.description && (
                <p
                  id="board-description-error"
                  role="alert"
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
                >
                  {errors.description.message}
                </p>
              )}
            </div>

            {/* Visibility */}
            <fieldset className="flex flex-col gap-1.5" style={{ border: "none", padding: 0 }}>
              <legend style={{ fontSize: 13, fontWeight: 500, color: "var(--color-fg)" }}>
                Visibility
              </legend>
              <div className="flex flex-col gap-2 mt-1">
                <label
                  className="flex items-center gap-2"
                  style={{ fontSize: 14, cursor: "pointer" }}
                >
                  <input
                    type="radio"
                    value="false"
                    {...register("isPrivate", { setValueAs: (v) => v === "true" })}
                    defaultChecked
                  />
                  <span style={{ color: "var(--color-fg)" }}>
                    Workspace — visible to all members
                  </span>
                </label>
                <label
                  className="flex items-center gap-2"
                  style={{ fontSize: 14, cursor: "pointer" }}
                >
                  <input
                    type="radio"
                    value="true"
                    {...register("isPrivate", { setValueAs: (v) => v === "true" })}
                  />
                  <span style={{ color: "var(--color-fg)" }}>Private — only invited members</span>
                </label>
              </div>
            </fieldset>

            {/* Template */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="board-template"
                style={{ fontSize: 13, fontWeight: 500, color: "var(--color-fg)" }}
              >
                Template
              </label>
              <select
                id="board-template"
                style={{
                  padding: "8px 12px",
                  border: "1px solid var(--color-border-solid)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 14,
                  color: "var(--color-fg)",
                  backgroundColor: "var(--color-surface)",
                  outline: "none",
                  width: "100%",
                }}
                {...register("template")}
              >
                <option value="blank">Blank</option>
                <option value="kanban" disabled>
                  Kanban — Coming soon
                </option>
                <option value="calendar" disabled>
                  Calendar — Coming soon
                </option>
                <option value="timeline" disabled>
                  Timeline — Coming soon
                </option>
                <option value="dashboard" disabled>
                  Dashboard — Coming soon
                </option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-2">
              <Dialog.Close
                type="button"
                disabled={pending}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "var(--color-surface-hover)",
                  border: "1px solid var(--color-border-solid)",
                  borderRadius: "var(--radius-sm)",
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
                type="submit"
                disabled={pending}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "var(--color-primary)",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "white",
                  cursor: pending ? "not-allowed" : "pointer",
                  opacity: pending ? 0.7 : 1,
                }}
              >
                {pending ? "Creating…" : "Create board"}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
