/**
 * Activity renderer registry — stub for Slice E type-checking.
 * Slice D owns this file and will replace it with the full implementation.
 *
 * DO NOT edit this stub. Slice D will overwrite it entirely.
 */

import type { ReactNode } from "react";
import type { Database } from "@/lib/supabase/types";
import type { ActivityRow } from "@/stores/types/comments";

type ColumnRow = Database["public"]["Tables"]["column"]["Row"];
type LabelRow = Database["public"]["Tables"]["label"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profile"]["Row"];

export type ActivityRenderCtx = {
  columns: Map<string, ColumnRow>;
  labelsByColumn: Map<string, LabelRow[]>;
  profiles: Map<string, ProfileRow>;
};

export type ActivityRenderer = (event: ActivityRow, ctx: ActivityRenderCtx) => ReactNode;

/** Placeholder registry — replaced by Slice D. */
export const activityRenderers: Record<string, ActivityRenderer> = {};
