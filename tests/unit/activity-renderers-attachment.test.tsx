import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

/**
 * Unit tests for attachment activity renderers.
 *
 * NOTE: These tests cannot run until Vitest + React Testing Library are installed
 * in epic 15.
 *
 * Tests:
 * - attachment.uploaded renders "{actor} uploaded {filename}".
 * - attachment.deleted renders "{actor} deleted {filename}" with strikethrough.
 * - Both renderers are registered in the activityRenderers registry.
 */

import type { ActivityRenderCtx } from "../../components/activity/renderers/index";
import { activityRenderers } from "../../components/activity/renderers/index";
import type { Database } from "../../lib/supabase/types";

type ActivityRow = Database["public"]["Tables"]["activity"]["Row"];

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

function makeEvent(
  type: string,
  // biome-ignore lint/suspicious/noExplicitAny: test fixture
  payload: Record<string, any> = {},
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("attachment activity renderers", () => {
  it("attachment.uploaded renders '{actor} uploaded {filename}'", () => {
    const event = makeEvent("attachment.uploaded", {
      attachmentId: "a1",
      filename: "screenshot.png",
      mimeType: "image/png",
      sizeBytes: 12345,
    });

    const renderer = activityRenderers["attachment.uploaded"];
    expect(renderer).toBeTruthy();

    if (!renderer) throw new Error("renderer not found");
    const node = renderer(event, ctx);
    const { container } = render(node);

    expect(container.textContent).toContain("Alice");
    expect(container.textContent).toContain("uploaded");
    expect(container.textContent).toContain("screenshot.png");
  });

  it("attachment.deleted renders '{actor} deleted {filename}' with strikethrough", () => {
    const event = makeEvent("attachment.deleted", {
      attachmentId: "a1",
      filename: "old-file.docx",
    });

    const renderer = activityRenderers["attachment.deleted"];
    expect(renderer).toBeTruthy();

    if (!renderer) throw new Error("renderer not found");
    const node = renderer(event, ctx);
    const { container } = render(node);

    expect(container.textContent).toContain("Alice");
    expect(container.textContent).toContain("deleted");
    expect(container.textContent).toContain("old-file.docx");

    // Filename should be rendered with line-through styling.
    const strikethrough = container.querySelector(".line-through");
    expect(strikethrough).toBeTruthy();
    expect(strikethrough?.textContent).toContain("old-file.docx");
  });

  it("attachment.uploaded is registered in activityRenderers", () => {
    expect("attachment.uploaded" in activityRenderers).toBe(true);
  });

  it("attachment.deleted is registered in activityRenderers", () => {
    expect("attachment.deleted" in activityRenderers).toBe(true);
  });

  it("attachment.uploaded handles missing filename gracefully", () => {
    const event = makeEvent("attachment.uploaded", { attachmentId: "a1" });

    const renderer = activityRenderers["attachment.uploaded"];
    if (!renderer) throw new Error("renderer not found");
    const node = renderer(event, ctx);
    const { container } = render(node);

    // Falls back to "a file" when filename is absent.
    expect(container.textContent).toContain("a file");
  });

  it("attachment.deleted handles missing filename gracefully", () => {
    const event = makeEvent("attachment.deleted", { attachmentId: "a1" });

    const renderer = activityRenderers["attachment.deleted"];
    if (!renderer) throw new Error("renderer not found");
    const node = renderer(event, ctx);
    const { container } = render(node);

    expect(container.textContent).toContain("a file");
  });
});
