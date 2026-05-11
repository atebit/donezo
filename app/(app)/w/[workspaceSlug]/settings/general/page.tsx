import { notFound } from "next/navigation";
import { getWorkspaceRole } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { DeleteWorkspaceModal } from "./delete-workspace-modal";
import { GeneralForm } from "./general-form";

export default async function GeneralSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from("workspace")
    .select("id, name, slug")
    .eq("slug", workspaceSlug)
    .is("deleted_at", null)
    .single();

  if (!workspace) notFound();

  const role = await getWorkspaceRole(workspace.id);
  if (!role) notFound();

  return (
    <div className="max-w-[720px]">
      <GeneralForm
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        workspaceSlug={workspace.slug}
      />

      {/* Danger zone — owner-only delete */}
      {role === "owner" && (
        <section
          aria-labelledby="danger-heading"
          className="mt-8 rounded-xl border border-destructive/30 bg-surface p-6"
        >
          <h2 id="danger-heading" className="mb-2 text-base font-semibold text-destructive">
            Danger zone
          </h2>
          <p className="mb-4 text-sm text-[color:var(--color-fg-muted)]">
            Deleting the workspace is permanent and cannot be undone.
          </p>
          <DeleteWorkspaceModal workspaceId={workspace.id} workspaceName={workspace.name} />
        </section>
      )}

      {role === "admin" && (
        <section
          aria-labelledby="danger-heading"
          className="mt-8 rounded-xl border border-[color:var(--color-border)] bg-surface p-6 opacity-60"
        >
          <h2
            id="danger-heading"
            className="mb-2 text-base font-semibold text-[color:var(--color-fg-muted)]"
          >
            Danger zone
          </h2>
          <p className="mb-4 text-sm text-[color:var(--color-fg-muted)]">
            Only the workspace owner can delete the workspace.
          </p>
          <Button disabled title="Only workspace owners can delete the workspace">
            Delete workspace
          </Button>
        </section>
      )}
    </div>
  );
}

// Inline button component for the disabled state (server component context)
function Button({
  children,
  disabled,
  title,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      className="inline-flex items-center rounded-md border border-[color:var(--color-border)] px-3 py-1.5 text-sm font-medium text-[color:var(--color-fg-muted)] cursor-not-allowed opacity-50"
    >
      {children}
    </button>
  );
}
