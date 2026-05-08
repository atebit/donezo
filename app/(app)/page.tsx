import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { FirstRun } from "./_components/first-run";

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
    .map((m) => m.workspace)
    .filter(
      (
        w,
      ): w is {
        id: string;
        slug: string;
        name: string;
        deleted_at: string | null;
        created_at: string;
      } => w !== null && (w as { deleted_at: string | null }).deleted_at === null,
    );

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
