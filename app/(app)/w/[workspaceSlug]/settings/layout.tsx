import { redirect } from "next/navigation";
import { getWorkspaceRole } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  // Verify the workspace exists and the user has access
  const supabase = await createClient();
  const { data: workspace } = await supabase
    .from("workspace")
    .select("id, name, slug")
    .eq("slug", workspaceSlug)
    .is("deleted_at", null)
    .single();

  if (!workspace) redirect("/");

  const role = await getWorkspaceRole(workspace.id);
  if (!role) redirect("/");

  // Only admin and owner can access settings
  if (role === "member" || role === "viewer") redirect(`/w/${workspaceSlug}`);

  return (
    <div
      className="min-h-screen bg-[color:var(--color-surface-rail)]"
      style={{ padding: "40px 24px" }}
    >
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-8 text-2xl font-semibold text-[color:var(--color-fg-strong)]">
          Settings
        </h1>
        <div className="flex gap-8">
          {/* Left nav rail — client component to highlight active link */}
          <aside className="w-48 shrink-0">
            <SettingsNav workspaceSlug={workspaceSlug} />
          </aside>
          {/* Right content pane */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
