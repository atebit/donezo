import { SidebarShell } from "@/components/shared/sidebar/SidebarShell";
import { NotificationsBootstrap } from "@/components/shared/topbar/NotificationsBootstrap";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import type { AnyNotification } from "@/stores/notification-store";

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();

  // Parallel: workspaces + initial notifications + unread count
  const [workspacesRes, notificationsRes, unreadRes] = await Promise.all([
    supabase
      .from("workspace_member")
      .select("workspace:workspace_id(id, slug, name)")
      .eq("user_id", user.id)
      .is("workspace.deleted_at", null),
    supabase
      .from("notification")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("notification")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
  ]);

  const initialNotifications = (notificationsRes.data ?? []) as AnyNotification[];
  const initialUnreadCount = unreadRes.count ?? 0;

  return (
    <SidebarShell user={user} workspaces={workspacesRes.data ?? []}>
      <NotificationsBootstrap
        userId={user.id}
        initialNotifications={initialNotifications}
        initialUnreadCount={initialUnreadCount}
      />
      {children}
    </SidebarShell>
  );
}
