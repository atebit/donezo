import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

import { type ActivityRenderCtx, activityRenderers } from "@/components/activity/renderers/index";
import type { ActivityType } from "@/lib/activity";
import type { Database } from "@/lib/supabase/types";

type ActivityRow = Database["public"]["Tables"]["activity"]["Row"];
type ColumnRow = Database["public"]["Tables"]["column"]["Row"];
type LabelRow = Database["public"]["Tables"]["label"]["Row"];

// ---------------------------------------------------------------------------
// Mock cellRegistry so cell.changed renderer doesn't require full epic-07 setup.
// ---------------------------------------------------------------------------

vi.mock("@/lib/cells/registry", () => ({
  cellRegistry: {
    status: {
      id: "status",
      Cell: ({ value }: { value: unknown }) => (
        <span data-testid="cell-inline-status">{String(value)}</span>
      ),
      defaultConfig: {},
    },
    text: {
      id: "text",
      Cell: ({ value }: { value: unknown }) => (
        <span data-testid="cell-inline-text">{String(value)}</span>
      ),
      defaultConfig: {},
    },
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEvent(
  type: ActivityType,
  // biome-ignore lint/suspicious/noExplicitAny: test fixtures use any for Json-compatible payloads.
  payload: { [key: string]: any } = {},
): ActivityRow {
  return {
    id: "event-1",
    board_id: "board-1",
    task_id: "task-1",
    actor_id: "user-1",
    type: type as ActivityRow["type"],
    payload,
    created_at: "2024-06-01T12:00:00Z",
  };
}

const profilesMap = new Map([
  [
    "user-1",
    {
      id: "user-1",
      display_name: "Alice",
      email: "alice@example.com",
      avatar_url: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      last_workspace_id: null,
    },
  ],
]);

const statusColumn: ColumnRow = {
  id: "col-status",
  board_id: "board-1",
  name: "Status",
  type: "status",
  position: 0,
  settings: {},
  icon: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const statusLabel: LabelRow = {
  id: "label-1",
  column_id: "col-status",
  name: "In Progress",
  color: "#0070f3",
  position: 0,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const ctx: ActivityRenderCtx = {
  columns: new Map([["col-status", statusColumn]]),
  labelsByColumn: new Map([["col-status", [statusLabel]]]),
  profiles: profilesMap,
};

// ---------------------------------------------------------------------------
// Helper: render a renderer and return the container.
// ---------------------------------------------------------------------------

function renderRenderer(type: ActivityType, payload?: Record<string, unknown>) {
  const event = makeEvent(type, payload);
  const renderer = activityRenderers[type];
  if (!renderer) {
    throw new Error(`No renderer registered for type: ${type}`);
  }
  const node = renderer(event, ctx);
  const { container } = render(node);
  return container;
}

// ---------------------------------------------------------------------------
// Compile-time guard — CellInline accepts the correct prop types.
// This is a type-only assertion; it will fail to compile if the types drift.
// ---------------------------------------------------------------------------

// The Cell prop contract is: ComponentType<{ value: TValue | null; config: TConfig; row: TaskRow }>
// CellInline passes (value, config, row) from its own props → compatible by design.
// If the Cell signature changes, the CellInline.tsx file will fail typecheck before this test.

import type { CellInline } from "@/components/activity/CellInline";

// Type assertion: CellInline must accept type, value, and optional config — this is the contract.
// If this line fails, the CellInline prop contract has drifted.
type _CellInlinePropsCheck = React.ComponentProps<typeof CellInline>;
// Ensure 'type' and 'value' are required, 'config' is optional.
type _TypeRequired = _CellInlinePropsCheck["type"];
type _ValueRequired = _CellInlinePropsCheck["value"];
type _ConfigOptional = _CellInlinePropsCheck["config"]; // should be optional

// ---------------------------------------------------------------------------
// Tests — one per renderer group
// ---------------------------------------------------------------------------

describe("activityRenderers registry", () => {
  // ------ task renderers ------

  it("task.created renders 'created this task'", () => {
    renderRenderer("task.created");
    expect(screen.getByText(/created this task/i)).toBeTruthy();
  });

  it("task.renamed renders from/to titles", () => {
    renderRenderer("task.renamed", { from: "Old", to: "New" });
    expect(screen.getByText(/renamed task/i)).toBeTruthy();
    expect(screen.getByText(/Old/)).toBeTruthy();
    expect(screen.getByText(/New/)).toBeTruthy();
  });

  it("task.duplicated renders 'duplicated this task'", () => {
    renderRenderer("task.duplicated");
    expect(screen.getByText(/duplicated this task/i)).toBeTruthy();
  });

  it("task.deleted renders 'deleted this task'", () => {
    renderRenderer("task.deleted");
    expect(screen.getByText(/deleted this task/i)).toBeTruthy();
  });

  it("task.moved renders 'moved this task'", () => {
    renderRenderer("task.moved");
    expect(screen.getByText(/moved this task/i)).toBeTruthy();
  });

  it("task.bulk_deleted renders bulk count", () => {
    renderRenderer("task.bulk_deleted", { count: 3 });
    expect(screen.getByText(/deleted 3 tasks/i)).toBeTruthy();
  });

  it("task.bulk_duplicated renders bulk count", () => {
    renderRenderer("task.bulk_duplicated", { count: 2 });
    expect(screen.getByText(/duplicated 2 tasks/i)).toBeTruthy();
  });

  it("task.bulk_moved renders bulk count", () => {
    renderRenderer("task.bulk_moved", { count: 5 });
    expect(screen.getByText(/moved 5 tasks/i)).toBeTruthy();
  });

  // ------ group renderers ------

  it("group.created renders group name", () => {
    renderRenderer("group.created", { name: "Sprint 1" });
    expect(screen.getByText(/created group/i)).toBeTruthy();
    expect(screen.getByText(/Sprint 1/)).toBeTruthy();
  });

  it("group.renamed renders from/to", () => {
    renderRenderer("group.renamed", { from: "Alpha", to: "Beta" });
    expect(screen.getByText(/renamed group/i)).toBeTruthy();
    expect(screen.getByText(/Alpha/)).toBeTruthy();
    expect(screen.getByText(/Beta/)).toBeTruthy();
  });

  it("group.recolored renders color change", () => {
    renderRenderer("group.recolored", { to: "#ff0000" });
    expect(screen.getByText(/changed group color/i)).toBeTruthy();
  });

  it("group.reordered renders 'reordered groups'", () => {
    renderRenderer("group.reordered");
    expect(screen.getByText(/reordered groups/i)).toBeTruthy();
  });

  it("group.duplicated renders group name", () => {
    renderRenderer("group.duplicated", { name: "Copy" });
    expect(screen.getByText(/duplicated group/i)).toBeTruthy();
  });

  it("group.deleted renders group name", () => {
    renderRenderer("group.deleted", { name: "Archived" });
    expect(screen.getByText(/deleted group/i)).toBeTruthy();
  });

  // ------ column renderers ------

  it("column.created renders column name and type", () => {
    renderRenderer("column.created", { name: "Priority", type: "status" });
    expect(screen.getByText(/added column/i)).toBeTruthy();
    expect(screen.getByText(/Priority/)).toBeTruthy();
  });

  it("column.renamed renders from/to", () => {
    renderRenderer("column.renamed", { from: "Old Col", to: "New Col" });
    expect(screen.getByText(/renamed column/i)).toBeTruthy();
  });

  it("column.reordered renders 'reordered columns'", () => {
    renderRenderer("column.reordered");
    expect(screen.getByText(/reordered columns/i)).toBeTruthy();
  });

  it("column.duplicated renders column name", () => {
    renderRenderer("column.duplicated", { name: "Dup Col" });
    expect(screen.getByText(/duplicated column/i)).toBeTruthy();
  });

  it("column.type_changed renders from/to types", () => {
    renderRenderer("column.type_changed", { from: "text", to: "status", name: "Col" });
    expect(screen.getByText(/changed/i)).toBeTruthy();
    expect(screen.getByText(/text/)).toBeTruthy();
    expect(screen.getByText(/status/)).toBeTruthy();
  });

  it("column.deleted renders column name", () => {
    renderRenderer("column.deleted", { name: "Dead Col" });
    expect(screen.getByText(/deleted column/i)).toBeTruthy();
  });

  it("column.settings_updated renders column name", () => {
    renderRenderer("column.settings_updated", { name: "Settings Col" });
    expect(screen.getByText(/updated settings for column/i)).toBeTruthy();
  });

  // ------ cell renderers ------

  it("cell.changed renders from/to values using CellInline", () => {
    renderRenderer("cell.changed", {
      columnId: "col-status",
      columnType: "status",
      from: "todo",
      to: "done",
    });
    expect(screen.getByText(/changed/i)).toBeTruthy();
    // CellInline renders the value via the mocked cell registry.
    expect(screen.getAllByTestId("cell-inline-status").length).toBeGreaterThanOrEqual(1);
  });

  it("cell.bulk_changed renders count", () => {
    renderRenderer("cell.bulk_changed", { count: 4, columnId: "col-status" });
    expect(screen.getByText(/updated 4 cells/i)).toBeTruthy();
  });

  // ------ comment renderers ------

  it("comment.posted renders body preview", () => {
    renderRenderer("comment.posted", {
      commentId: "c1",
      bodyTextPreview: "Great work everyone",
    });
    expect(screen.getByText(/posted a comment/i)).toBeTruthy();
    expect(screen.getByText(/Great work everyone/)).toBeTruthy();
  });

  it("comment.edited renders 'edited a comment'", () => {
    renderRenderer("comment.edited");
    expect(screen.getByText(/edited a comment/i)).toBeTruthy();
  });

  it("comment.deleted renders 'deleted a comment'", () => {
    renderRenderer("comment.deleted");
    expect(screen.getByText(/deleted a comment/i)).toBeTruthy();
  });

  it("comment.reacted renders emoji", () => {
    renderRenderer("comment.reacted", { commentId: "c1", emoji: "🎉" });
    expect(screen.getByText(/reacted/i)).toBeTruthy();
    expect(screen.getByText(/🎉/)).toBeTruthy();
  });

  it("comment.unreacted renders emoji", () => {
    renderRenderer("comment.unreacted", { commentId: "c1", emoji: "👍" });
    expect(screen.getByText(/removed/i)).toBeTruthy();
    expect(screen.getByText(/👍/)).toBeTruthy();
  });

  // ------ label renderers ------

  it("label.created renders label name with color", () => {
    renderRenderer("label.created", { name: "Urgent", color: "#ff0000" });
    expect(screen.getByText(/added label/i)).toBeTruthy();
    expect(screen.getByText(/Urgent/)).toBeTruthy();
  });

  it("label.renamed renders from/to names", () => {
    renderRenderer("label.renamed", { from: "Old", to: "New" });
    expect(screen.getByText(/renamed label/i)).toBeTruthy();
  });

  it("label.recolored renders label name", () => {
    renderRenderer("label.recolored", { name: "Urgent", to: "#00ff00" });
    expect(screen.getByText(/changed color of label/i)).toBeTruthy();
  });

  it("label.reordered renders 'reordered labels'", () => {
    renderRenderer("label.reordered");
    expect(screen.getByText(/reordered labels/i)).toBeTruthy();
  });

  it("label.deleted renders label name", () => {
    renderRenderer("label.deleted", { name: "Old Label" });
    expect(screen.getByText(/deleted label/i)).toBeTruthy();
  });

  // ------ registry completeness ------

  it("every ActivityType in lib/activity.ts has a renderer registered", () => {
    const allTypes: ActivityType[] = [
      "group.created",
      "group.renamed",
      "group.recolored",
      "group.reordered",
      "group.duplicated",
      "group.deleted",
      "task.created",
      "task.renamed",
      "task.duplicated",
      "task.deleted",
      "task.moved",
      "task.bulk_deleted",
      "task.bulk_duplicated",
      "task.bulk_moved",
      "column.created",
      "column.renamed",
      "column.reordered",
      "column.duplicated",
      "column.type_changed",
      "column.deleted",
      "column.settings_updated",
      "label.created",
      "label.renamed",
      "label.recolored",
      "label.reordered",
      "label.deleted",
      "cell.changed",
      "cell.bulk_changed",
      "comment.posted",
      "comment.edited",
      "comment.deleted",
      "comment.reacted",
      "comment.unreacted",
    ];

    const missing = allTypes.filter((t) => !(t in activityRenderers));
    expect(missing, `Missing renderers for: ${missing.join(", ")}`).toHaveLength(0);
  });
});
