import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActivityItem } from "@/components/activity/ActivityItem";
import type { ActivityRenderCtx } from "@/components/activity/renderers/index";
import type { Database } from "@/lib/supabase/types";

type ActivityRow = Database["public"]["Tables"]["activity"]["Row"];

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: "event-1",
    board_id: "board-1",
    task_id: "task-1",
    actor_id: "user-1",
    type: "task.created",
    payload: {},
    created_at: "2024-06-01T12:00:00Z",
    ...overrides,
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

const ctx: ActivityRenderCtx = {
  columns: new Map(),
  labelsByColumn: new Map(),
  profiles: profilesMap,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ActivityItem", () => {
  it("renders via registered renderer for a known activity type", () => {
    const event = makeEvent({ type: "task.created" });
    render(<ActivityItem event={event} ctx={ctx} />);
    // "task.created" renderer outputs "created this task"
    expect(screen.getByText(/created this task/i)).toBeTruthy();
  });

  it("renders actor name from profiles map", () => {
    const event = makeEvent({ type: "task.created", actor_id: "user-1" });
    render(<ActivityItem event={event} ctx={ctx} />);
    expect(screen.getByText(/Alice/)).toBeTruthy();
  });

  it("renders 'Someone' when actor_id is missing from profiles", () => {
    const event = makeEvent({ type: "task.created", actor_id: "unknown-user" });
    render(<ActivityItem event={event} ctx={ctx} />);
    expect(screen.getByText(/Someone/)).toBeTruthy();
  });

  it("falls back to generic renderer for an unknown activity type", () => {
    const event = makeEvent({ type: "unknown.future_type" as ActivityRow["type"] });
    render(<ActivityItem event={event} ctx={ctx} />);
    // Generic fallback renders "performed" and the type code.
    expect(screen.getByTestId("activity-fallback")).toBeTruthy();
    expect(screen.getByText(/performed/)).toBeTruthy();
    expect(screen.getByText(/unknown.future_type/)).toBeTruthy();
  });

  it("generic fallback renders payload in details block when payload is present", () => {
    const event = makeEvent({
      type: "unknown.with_payload" as ActivityRow["type"],
      payload: { key: "value" },
    });
    render(<ActivityItem event={event} ctx={ctx} />);
    expect(screen.getByTestId("activity-fallback")).toBeTruthy();
    // The details element wraps the payload JSON.
    const details = screen.getByRole("group") ?? document.querySelector("details");
    expect(details).toBeTruthy();
  });

  it("renders timestamp in a <time> element", () => {
    const event = makeEvent({ created_at: "2024-06-01T12:00:00Z" });
    render(<ActivityItem event={event} ctx={ctx} />);
    const time = document.querySelector("time");
    expect(time).toBeTruthy();
    expect(time?.getAttribute("dateTime")).toBe("2024-06-01T12:00:00Z");
  });

  it("renders comment.posted with body preview", () => {
    const event = makeEvent({
      type: "comment.posted",
      payload: { commentId: "c1", bodyTextPreview: "Great update!" },
    });
    render(<ActivityItem event={event} ctx={ctx} />);
    expect(screen.getByText(/posted a comment/i)).toBeTruthy();
    expect(screen.getByText(/Great update!/)).toBeTruthy();
  });

  it("renders comment.reacted with emoji", () => {
    const event = makeEvent({
      type: "comment.reacted",
      payload: { commentId: "c1", emoji: "🎉" },
    });
    render(<ActivityItem event={event} ctx={ctx} />);
    expect(screen.getByText(/reacted/i)).toBeTruthy();
    expect(screen.getByText(/🎉/)).toBeTruthy();
  });

  it("renders group.renamed with from/to names", () => {
    const event = makeEvent({
      type: "group.renamed",
      payload: { from: "Old Group", to: "New Group" },
    });
    render(<ActivityItem event={event} ctx={ctx} />);
    expect(screen.getByText(/renamed group/i)).toBeTruthy();
    expect(screen.getByText(/Old Group/)).toBeTruthy();
    expect(screen.getByText(/New Group/)).toBeTruthy();
  });
});
