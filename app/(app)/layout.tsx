import { SidebarShell } from "@/components/shared/sidebar/SidebarShell";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: workspaces } = await supabase
    .from("workspace_member")
    .select("workspace:workspace_id(id, slug, name)")
    .eq("user_id", user.id)
    .is("workspace.deleted_at", null);

  return (
    <SidebarShell user={user} workspaces={workspaces ?? []}>
      {children}
    </SidebarShell>
  );
}
