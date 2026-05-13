import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { FirstRun } from "./_components/first-run";

type WorkspaceRef = {
  id: string;
  slug: string;
  name: string;
  deleted_at: string | null;
  created_at: string;
};

// Supabase's TS generator types FK-joined relations as `T | T[] | null`
// depending on the FK shape; runtime is usually a single object for
// many-to-one joins but the types force us to handle both shapes.
function unwrapWorkspace(value: unknown): WorkspaceRef | null {
  if (value == null) return null;
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "object") return null;
  const w = candidate as Partial<WorkspaceRef>;
  if (!w.id || !w.slug || !w.name || w.created_at === undefined) return null;
  return {
    id: w.id,
    slug: w.slug,
    name: w.name,
    deleted_at: w.deleted_at ?? null,
    created_at: w.created_at,
  };
}

export default async function HomePage() {
  const user = await requireUser();
  const supabase = await createClient();

  // 1. Try the last-visited workspace.
  const { data: profile } = await supabase
    .from("profile")
    .select("last_workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.last_workspace_id) {
    const { data: ws } = await supabase
      .from("workspace")
      .select("slug")
      .eq("id", profile.last_workspace_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (ws) {
      redirect(`/w/${ws.slug}`);
    }
  }

  // 2. Fall back to any workspace the user is a member of (oldest first).
  const { data: memberships } = await supabase
    .from("workspace_member")
    .select("workspace:workspace_id(id, slug, name, deleted_at, created_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const active = (memberships ?? [])
    .map((m) => unwrapWorkspace((m as { workspace: unknown }).workspace))
    .filter((w): w is WorkspaceRef => w !== null && w.deleted_at === null);

  const first = active[0];
  if (first) {
    redirect(`/w/${first.slug}`);
  }

  // 3. No workspaces — show first-run empty state.
  return (
    <div className="flex h-full w-full items-center justify-center">
      <FirstRun />
    </div>
  );
}
