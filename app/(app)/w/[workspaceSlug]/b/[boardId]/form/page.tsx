/**
 * Form view page — /w/[workspaceSlug]/b/[boardId]/form?view=<id>
 *
 * Internal-only form that creates tasks on the current board.
 * Public sharing is deferred to v1.5 (epic 12 scope).
 *
 * Data is hydrated by the board layout via <BoardDataProvider>.
 * This page simply renders <FormView /> which reads from the already-
 * hydrated board store and the active view's config.
 *
 * Epic 12, Slice F — F.1.
 */
import { FormView } from "@/components/board/form/FormView";

export default function FormPage() {
  return <FormView />;
}
