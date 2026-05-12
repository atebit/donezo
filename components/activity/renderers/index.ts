/**
 * Activity renderer registry — maps every ActivityType to a render function.
 *
 * Every action id in lib/activity.ts's ActivityType union MUST have an entry here.
 * Missing entries fall back to the generic renderer in <ActivityItem />.
 *
 * ctx: ActivityRenderCtx — provides columns, labels, and profiles for rendering.
 */

import type { ReactNode } from "react";
import type { Database } from "@/lib/supabase/types";
import type { ActivityRow } from "@/stores/types/comments";
import { attachmentRenderers } from "./attachmentRenderers";
import { cellRenderers } from "./cell";
import { columnRenderers } from "./column";
import { commentRenderers } from "./comment";
import { groupRenderers } from "./group";
import { labelRenderers } from "./label";
import { taskRenderers } from "./task";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ColumnRow = Database["public"]["Tables"]["column"]["Row"];
export type LabelRow = Database["public"]["Tables"]["label"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profile"]["Row"];

export type ActivityRenderCtx = {
  /** All columns for the board, keyed by column id. */
  columns: Map<string, ColumnRow>;
  /** Labels for each column, keyed by column id. */
  labelsByColumn: Map<string, LabelRow[]>;
  /** Profiles for actors, keyed by user id. */
  profiles: Map<string, ProfileRow>;
};

export type ActivityRenderer = (event: ActivityRow, ctx: ActivityRenderCtx) => ReactNode;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const activityRenderers: Record<string, ActivityRenderer> = {
  ...taskRenderers,
  ...groupRenderers,
  ...columnRenderers,
  ...cellRenderers,
  ...commentRenderers,
  ...labelRenderers,
  ...attachmentRenderers,
};
