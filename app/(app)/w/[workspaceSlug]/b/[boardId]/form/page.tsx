/**
 * Form view page — /w/[workspaceSlug]/b/[boardId]/form?view=<id>
 *
 * RSC shell — same auth gates as other per-kind pages (table, kanban, calendar).
 * Data is hydrated by <BoardDataProvider> in the board layout (layout.tsx).
 *
 * <FormView /> reads live state from the board store; this page is a thin
 * passthrough that matches the established per-kind pattern.
 *
 * Epic 12, Slice F — F.1.
 */

import { FormView } from "@/components/board/form/FormView";

export default function FormPage() {
  return <FormView />;
}
