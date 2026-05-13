import type { Database } from "@/lib/supabase/types";

/** A single row from the `public.view` table. */
export type ViewRow = Database["public"]["Tables"]["view"]["Row"];
