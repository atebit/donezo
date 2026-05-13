// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it } from "vitest";
import { buildViewUrl, kindFromPathname, viewKindToSegment } from "../../lib/views/kind-router";
import type { ViewRow } from "../../stores/types/views";

/**
 * kind-router.test.ts
 *
 * Tests for the pure URL helpers in lib/views/kind-router.ts.
 * Epic 12, Slice A §A.7.
 */

// ---------------------------------------------------------------------------
// viewKindToSegment
// ---------------------------------------------------------------------------

describe("viewKindToSegment", () => {
  it("maps 'table' to '' (bare board route)", () => {
    expect(viewKindToSegment("table")).toBe("");
  });

  it("maps 'kanban' to 'kanban'", () => {
    expect(viewKindToSegment("kanban")).toBe("kanban");
  });

  it("maps 'calendar' to 'calendar'", () => {
    expect(viewKindToSegment("calendar")).toBe("calendar");
  });

  it("maps 'timeline' to 'timeline'", () => {
    expect(viewKindToSegment("timeline")).toBe("timeline");
  });

  it("maps 'dashboard' to 'dashboard'", () => {
    expect(viewKindToSegment("dashboard")).toBe("dashboard");
  });

  it("maps 'form' to 'form'", () => {
    expect(viewKindToSegment("form")).toBe("form");
  });

  it("maps an unknown kind to itself (passthrough)", () => {
    // Unknown kinds map to themselves, not to "".
    expect(viewKindToSegment("custom")).toBe("custom");
  });
});

// ---------------------------------------------------------------------------
// kindFromPathname
// ---------------------------------------------------------------------------

describe("kindFromPathname", () => {
  it("returns 'table' for the bare board route", () => {
    expect(kindFromPathname("/w/acme/b/board-123")).toBe("table");
  });

  it("returns 'table' for a bare board route with trailing slash", () => {
    // The regex looks for a segment after the board id; a trailing slash
    // without a named segment still returns "table".
    expect(kindFromPathname("/w/acme/b/board-123/")).toBe("table");
  });

  it("returns 'kanban' for a kanban route", () => {
    expect(kindFromPathname("/w/acme/b/board-123/kanban")).toBe("kanban");
  });

  it("returns 'calendar' for a calendar route", () => {
    expect(kindFromPathname("/w/acme/b/board-123/calendar")).toBe("calendar");
  });

  it("returns 'timeline' for a timeline route", () => {
    expect(kindFromPathname("/w/acme/b/board-123/timeline")).toBe("timeline");
  });

  it("returns 'dashboard' for a dashboard route", () => {
    expect(kindFromPathname("/w/acme/b/board-123/dashboard")).toBe("dashboard");
  });

  it("returns 'form' for a form route", () => {
    expect(kindFromPathname("/w/acme/b/board-123/form")).toBe("form");
  });

  it("ignores query string when extracting kind — kanban", () => {
    expect(kindFromPathname("/w/acme/b/board-123/kanban?view=abc")).toBe("kanban");
  });

  it("ignores query string when extracting kind — table", () => {
    expect(kindFromPathname("/w/acme/b/board-123?view=abc")).toBe("table");
  });

  it("returns 'table' for unrecognised segments (e.g. 'settings')", () => {
    // 'settings' is not a valid view kind; falls back to 'table'.
    expect(kindFromPathname("/w/acme/b/board-123/settings")).toBe("table");
  });

  it("handles UUID board ids with hyphens", () => {
    expect(kindFromPathname("/w/my-workspace/b/a1b2c3d4-0000-4abc-89ab-111111111111/kanban")).toBe(
      "kanban",
    );
  });
});

// ---------------------------------------------------------------------------
// buildViewUrl
// ---------------------------------------------------------------------------

const makeView = (id: string, kind: string): ViewRow =>
  ({
    id,
    kind,
    name: "Test view",
    board_id: "board-123",
    owner_id: null,
    is_shared: true,
    position: 0,
    config: {},
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  }) as unknown as ViewRow;

describe("buildViewUrl", () => {
  it("builds a table URL on the bare board route (no kind segment)", () => {
    const view = makeView("view-id-1", "table");
    const url = buildViewUrl("acme", "board-123", view);
    expect(url).toBe("/w/acme/b/board-123?view=view-id-1");
  });

  it("builds a kanban URL with kind segment", () => {
    const view = makeView("view-id-2", "kanban");
    const url = buildViewUrl("acme", "board-123", view);
    expect(url).toBe("/w/acme/b/board-123/kanban?view=view-id-2");
  });

  it("builds a calendar URL with kind segment", () => {
    const view = makeView("view-id-3", "calendar");
    const url = buildViewUrl("acme", "board-123", view);
    expect(url).toBe("/w/acme/b/board-123/calendar?view=view-id-3");
  });

  it("builds a timeline URL with kind segment", () => {
    const view = makeView("view-id-4", "timeline");
    const url = buildViewUrl("acme", "board-123", view);
    expect(url).toBe("/w/acme/b/board-123/timeline?view=view-id-4");
  });

  it("builds a dashboard URL with kind segment", () => {
    const view = makeView("view-id-5", "dashboard");
    const url = buildViewUrl("acme", "board-123", view);
    expect(url).toBe("/w/acme/b/board-123/dashboard?view=view-id-5");
  });

  it("builds a form URL with kind segment", () => {
    const view = makeView("view-id-6", "form");
    const url = buildViewUrl("acme", "board-123", view);
    expect(url).toBe("/w/acme/b/board-123/form?view=view-id-6");
  });

  it("round-trips: buildViewUrl then kindFromPathname recovers the kind — kanban", () => {
    const view = makeView("view-id-7", "kanban");
    const url = buildViewUrl("ws", "b1", view);
    expect(kindFromPathname(url)).toBe("kanban");
  });

  it("round-trips: buildViewUrl then kindFromPathname recovers the kind — table", () => {
    const view = makeView("view-id-8", "table");
    const url = buildViewUrl("ws", "b1", view);
    expect(kindFromPathname(url)).toBe("table");
  });

  it("handles slugs with hyphens and boards with UUID ids", () => {
    const view = makeView("a1b2c3d4-0000-4abc-89ab-111111111111", "calendar");
    const url = buildViewUrl("my-workspace", "a1b2c3d4-0000-4abc-89ab-222222222222", view);
    expect(url).toBe(
      "/w/my-workspace/b/a1b2c3d4-0000-4abc-89ab-222222222222/calendar?view=a1b2c3d4-0000-4abc-89ab-111111111111",
    );
  });
});
