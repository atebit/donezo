"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type RenameWorkspaceInput,
  RenameWorkspaceSchema,
  UpdateWorkspaceSlugSchema,
} from "@/lib/validations/workspace";
import { renameWorkspace, updateWorkspaceSlug } from "./actions";

interface GeneralFormProps {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
}

// ── Rename section (uses zodResolver) ────────────────────────────────────────

function RenameSection({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RenameWorkspaceInput>({
    resolver: zodResolver(RenameWorkspaceSchema),
    defaultValues: { workspaceId, name: workspaceName },
  });

  function onSubmit(values: RenameWorkspaceInput) {
    startTransition(async () => {
      const result = await renameWorkspace(values);
      if (result.ok) {
        toast.success("Workspace renamed.");
      } else if (result.error.field) {
        setError(result.error.field as keyof RenameWorkspaceInput, {
          message: result.error.message,
        });
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <section
      aria-labelledby="rename-heading"
      className="rounded-xl border border-[color:var(--color-border)] bg-surface p-6"
    >
      <h2
        id="rename-heading"
        className="mb-4 text-base font-semibold text-[color:var(--color-fg-strong)]"
      >
        Workspace name
      </h2>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <input type="hidden" {...register("workspaceId")} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            type="text"
            autoComplete="off"
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
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

// ── Slug section (manual Zod validation to avoid a second zodResolver squiggle) ──

function SlugSection({
  workspaceId,
  workspaceSlug,
}: {
  workspaceId: string;
  workspaceSlug: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [slugError, setSlugError] = useState<string | null>(null);
  const slugRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const slug = slugRef.current?.value.trim() ?? "";
    const parse = UpdateWorkspaceSlugSchema.safeParse({ workspaceId, slug });
    if (!parse.success) {
      const msg =
        parse.error.issues.find((i) => i.path.includes("slug"))?.message ?? "Invalid slug.";
      setSlugError(msg);
      return;
    }
    setSlugError(null);
    startTransition(async () => {
      const result = await updateWorkspaceSlug(parse.data);
      if (result.ok) {
        toast.success("Slug updated. Redirecting…");
        router.push(`/w/${slug}/settings/general`);
      } else if (result.error.field) {
        setSlugError(result.error.message);
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <section
      aria-labelledby="slug-heading"
      className="rounded-xl border border-[color:var(--color-border)] bg-surface p-6"
    >
      <h2
        id="slug-heading"
        className="mb-1 text-base font-semibold text-[color:var(--color-fg-strong)]"
      >
        Workspace URL
      </h2>
      <p className="mb-4 text-sm text-[color:var(--color-fg-muted)]">
        <strong className="font-medium text-[color:var(--color-label-orange)]">Warning:</strong>{" "}
        Changing the slug will break any previously shared links.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug">Slug</Label>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-[color:var(--color-fg-muted)]">/w/</span>
            <Input
              id="slug"
              ref={slugRef}
              type="text"
              autoComplete="off"
              defaultValue={workspaceSlug}
              aria-invalid={!!slugError}
            />
          </div>
          {slugError && <p className="text-sm text-destructive">{slugError}</p>}
        </div>
        <div>
          <Button type="submit" disabled={pending} size="sm">
            {pending ? "Saving…" : "Save URL"}
          </Button>
        </div>
      </form>
    </section>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function GeneralForm({ workspaceId, workspaceName, workspaceSlug }: GeneralFormProps) {
  return (
    <div className="flex flex-col gap-6">
      <RenameSection workspaceId={workspaceId} workspaceName={workspaceName} />
      <SlugSection workspaceId={workspaceId} workspaceSlug={workspaceSlug} />
    </div>
  );
}
