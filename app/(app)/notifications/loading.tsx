import { NotificationCenterSkeleton } from "@/components/shared/skeletons/NotificationCenterSkeleton";

/**
 * Notifications route loading skeleton.
 *
 * Shown while app/(app)/notifications/page.tsx is fetching notifications
 * from the server.
 */
export default function NotificationsLoading() {
  return <NotificationCenterSkeleton />;
}
