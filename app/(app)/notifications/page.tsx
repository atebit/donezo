/**
 * app/(app)/notifications/page.tsx
 *
 * Full-page "All notifications" view. Reuses <NotificationList> primitive.
 * Fetches up to 200 notifications server-side for the current user.
 */

import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import type { AnyNotification } from "@/stores/notification-store";
import { NotificationListPage } from "./_components/notification-list-page";

export const metadata = {
  title: "Notifications",
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("notification")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const notifications = (data ?? []) as AnyNotification[];

  return <NotificationListPage notifications={notifications} />;
}
