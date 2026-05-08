"use client";

import { Dialog } from "@base-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { createWorkspace } from "@/app/(app)/actions";

// Local schema without .default() so input/output types match, avoiding the
// extra cascading TS errors (TS2322/TS2345/TS2339) that arise when Zod 4 schema
// defaults cause input/output type divergence in the @hookform resolver overloads.
// The one TS2769 that remains here is the pre-existing Zod 4 / @hookform compat
// issue — identical in kind to other modals in the codebase.
const FormSchema = z.object({
  name: z.string().min(1, "Name is required.").max(80, "Name must be 80 characters or fewer."),
  slug: z
    .string()
    .min(2, "Slug must be at least 2 characters.")
    .max(40, "Slug must be 40 characters or fewer.")
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only."),
});

type FormValues = z.infer<typeof FormSchema>;

type CreateWorkspaceModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function CreateWorkspaceModal({ open, onOpenChange }: CreateWorkspaceModalProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const nameValue = watch("name");

  // Auto-generate slug from name unless the user has manually edited it.
  useEffect(() => {
    if (!dirtyFields.slug) {
      setValue("slug", slugify(nameValue), { shouldValidate: false });
    }
  }, [nameValue, dirtyFields.slug, setValue]);

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await createWorkspace(values);
      if (result.ok && result.data) {
        const workspace = result.data as { slug: string };
        reset();
        onOpenChange(false);
        router.push(`/w/${workspace.slug}`);
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
            Create workspace
          </Dialog.Title>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            {/* Workspace name */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="workspace-name"
                style={{ fontSize: 13, fontWeight: 500, color: "var(--color-fg)" }}
              >
                Name
                <span aria-hidden="true" style={{ color: "var(--color-danger)", marginLeft: 2 }}>
                  *
                </span>
              </label>
              <input
                id="workspace-name"
                type="text"
                autoComplete="off"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "workspace-name-error" : undefined}
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
                  id="workspace-name-error"
                  role="alert"
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
                >
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Slug */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="workspace-slug"
                style={{ fontSize: 13, fontWeight: 500, color: "var(--color-fg)" }}
              >
                URL slug
                <span aria-hidden="true" style={{ color: "var(--color-danger)", marginLeft: 2 }}>
                  *
                </span>
              </label>
              <input
                id="workspace-slug"
                type="text"
                autoComplete="off"
                aria-invalid={!!errors.slug}
                aria-describedby={errors.slug ? "workspace-slug-error" : "workspace-slug-hint"}
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
                {...register("slug")}
              />
              {errors.slug ? (
                <p
                  id="workspace-slug-error"
                  role="alert"
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
                >
                  {errors.slug.message}
                </p>
              ) : (
                <p
                  id="workspace-slug-hint"
                  style={{ fontSize: 12, color: "var(--color-fg-muted)" }}
                >
                  donezo.app/w/{watch("slug") || "your-workspace"}
                </p>
              )}
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
                {pending ? "Creating…" : "Create workspace"}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
