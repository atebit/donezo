import { NotificationsBootstrap } from "@/components/shared/topbar/NotificationsBootstrap";
import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import type { AnyNotification } from "@/stores/notification-store";

/**
 * Outer authed layout — auth guard, notifications bootstrap.
 *
 * NOTE: SidebarShell is intentionally NOT mounted here. It is mounted by
 * app/(app)/w/[workspaceSlug]/layout.tsx so that WorkspaceProvider can wrap
 * both the sidebar and page content, making useWorkspaceMaybe() return the
 * active workspace inside WorkspaceSidebar / WorkspaceSwitcher.
 *
 * Non-workspace routes (account, notifications) render without the workspace
 * sidebar — they have no workspace context and showing "Select workspace" is
 * misleading.
 */
export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();

  const [notificationsRes, unreadRes] = await Promise.all([
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
    <>
      <NotificationsBootstrap
        userId={user.id}
        initialNotifications={initialNotifications}
        initialUnreadCount={initialUnreadCount}
      />
      {children}
    </>
  );
}
