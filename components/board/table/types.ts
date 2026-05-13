import type { Database } from "@/lib/supabase/types";
import type { ViewRow } from "@/stores/types/views";

export type Group = Database["public"]["Tables"]["group"]["Row"];
export type Task = Database["public"]["Tables"]["task"]["Row"];
export type Cell = Database["public"]["Tables"]["cell"]["Row"];
export type Column = Database["public"]["Tables"]["column"]["Row"];
export type AttachmentRow = Database["public"]["Tables"]["attachment"]["Row"];

export type TableData = {
  groups: Group[];
  tasks: Task[];
  cells: Cell[];
  columns: Column[];
  attachments?: AttachmentRow[];
  /** Epic 11 / Slice F — server-resolved views for this board. */
  views?: ViewRow[];
  /** Epic 11 / Slice F — server-resolved initial active view id. */
  activeViewId?: string | null;
  /** Epic 11 / Slice F — current authenticated user's id. */
  currentUserId: string;
};
