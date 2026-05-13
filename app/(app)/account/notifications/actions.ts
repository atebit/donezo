"use server";

/**
 * app/(app)/account/notifications/actions.ts
 *
 * Server action for updating notification preferences.
 * Upserts the notification_preference row for the current user.
 */

import { withUser } from "@/lib/actions";
import { UpdatePreferencesSchema } from "@/lib/validations/notifications";

export const updatePreferences = withUser(async ({ supabase, userId }, raw) => {
  const input = UpdatePreferencesSchema.parse(raw);

  const { error } = await supabase.from("notification_preference").upsert(
    {
      user_id: userId,
      prefs: input.prefs ?? {},
      digest_enabled: input.digestEnabled,
      digest_hour: input.digestHour,
      digest_timezone: input.digestTimezone,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw { code: "DB_ERROR", message: error.message };
  }

  return { saved: true };
});
