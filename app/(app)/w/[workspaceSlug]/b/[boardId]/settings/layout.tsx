import { notFound } from "next/navigation";
import { getBoardRole } from "@/lib/authorization";
import { createClient } from "@/lib/supabase/server";
import { BoardSettingsNav } from "./settings-nav";

export default async function BoardSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string; boardId: string }>;
}) {
  const { workspaceSlug, boardId } = await params;

  const supabase = await createClient();

  // Load board to verify it exists and is not deleted
  const { data: board } = await supabase
    .from("board")
    .select("id, name, workspace_id")
    .eq("id", boardId)
    .is("deleted_at", null)
    .single();

  if (!board) notFound();

  // Require admin role on the board to access settings
  const boardRole = await getBoardRole(board.id);
  if (!boardRole || boardRole === "viewer" || boardRole === "member") notFound();

  return (
    <div
      className="min-h-screen bg-[color:var(--color-surface-rail)]"
      style={{ padding: "40px 24px" }}
    >
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-8 text-2xl font-semibold text-[color:var(--color-fg-strong)]">
          Board settings
        </h1>
        <div className="flex gap-8">
          {/* Left nav rail */}
          <aside className="w-48 shrink-0">
            <BoardSettingsNav workspaceSlug={workspaceSlug} boardId={board.id} />
          </aside>
          {/* Right content pane */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
