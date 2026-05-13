/**
 * app/(app)/account/notifications/page.tsx
 *
 * Notification preferences page under account settings.
 * Fetches the user's current preference row (null → use defaults).
 */

import { requireUser } from "@/lib/auth/current-user";
import type { NotificationPreference } from "@/lib/notifications/types";
import { createClient } from "@/lib/supabase/server";
import { NotificationSettings } from "./notification-settings";

export const metadata = {
  title: "Notification preferences",
};

export default async function NotificationPreferencesPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("notification_preference")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const preference = data as NotificationPreference | null;

  return <NotificationSettings preference={preference} />;
}
