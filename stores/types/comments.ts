import type { Database } from "@/lib/supabase/types";

export type CommentRow = Database["public"]["Tables"]["comment"]["Row"];
export type CommentReactionRow = Database["public"]["Tables"]["comment_reaction"]["Row"];
export type ActivityRow = Database["public"]["Tables"]["activity"]["Row"];
