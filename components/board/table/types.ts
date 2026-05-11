import type { Database } from "@/lib/supabase/types";

export type Group = Database["public"]["Tables"]["group"]["Row"];
export type Task = Database["public"]["Tables"]["task"]["Row"];
export type Cell = Database["public"]["Tables"]["cell"]["Row"];
export type Column = Database["public"]["Tables"]["column"]["Row"];

export type TableData = {
  groups: Group[];
  tasks: Task[];
  cells: Cell[];
  columns: Column[];
};
