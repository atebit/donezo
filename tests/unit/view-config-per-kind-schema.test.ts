// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it } from "vitest";

/**
 * view-config-per-kind-schema.test.ts
 *
 * Tests for the per-kind Zod config schemas added in Epic 12, Slice A §A.11.
 *
 * Verifies:
 *   1. Each kind's schema parses a well-formed config object.
 *   2. Each kind's schema rejects a malformed config (and parseViewConfig falls back to {}).
 *   3. The top-level ViewConfigSchema accepts per-kind configs under their keys.
 */

import {
  CalendarConfigSchema,
  DashboardConfigSchema,
  FormConfigSchema,
  KanbanConfigSchema,
  parseViewConfig,
  TimelineConfigSchema,
  ViewConfigSchema,
} from "@/lib/views/config-schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "a1b2c3d4-1234-4abc-89ab-000000000001";

// ---------------------------------------------------------------------------
// KanbanConfigSchema
// ---------------------------------------------------------------------------

describe("KanbanConfigSchema", () => {
  it("parses a well-formed kanban config (groupByColumnId = uuid)", () => {
    const result = KanbanConfigSchema.safeParse({ groupByColumnId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.groupByColumnId).toBe(VALID_UUID);
    }
  });

  it("parses a kanban config with null groupByColumnId (empty-state)", () => {
    const result = KanbanConfigSchema.safeParse({ groupByColumnId: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.groupByColumnId).toBeNull();
    }
  });

  it("applies defaults when given an empty object", () => {
    const result = KanbanConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.groupByColumnId).toBeNull();
    }
  });

  it("rejects a groupByColumnId that is neither uuid nor null", () => {
    const result = KanbanConfigSchema.safeParse({ groupByColumnId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CalendarConfigSchema
// ---------------------------------------------------------------------------

describe("CalendarConfigSchema", () => {
  it("parses a well-formed calendar config", () => {
    const result = CalendarConfigSchema.safeParse({
      dateColumnId: VALID_UUID,
      viewMode: "week",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dateColumnId).toBe(VALID_UUID);
      expect(result.data.viewMode).toBe("week");
    }
  });

  it("applies defaults for viewMode when absent", () => {
    const result = CalendarConfigSchema.safeParse({ dateColumnId: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.viewMode).toBe("month");
    }
  });

  it("rejects an invalid viewMode value", () => {
    const result = CalendarConfigSchema.safeParse({
      dateColumnId: null,
      viewMode: "yearly", // not in enum
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TimelineConfigSchema
// ---------------------------------------------------------------------------

describe("TimelineConfigSchema", () => {
  it("parses a well-formed timeline config", () => {
    const result = TimelineConfigSchema.safeParse({
      timelineColumnId: VALID_UUID,
      scale: "month",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scale).toBe("month");
    }
  });

  it("applies default scale = 'week' when absent", () => {
    const result = TimelineConfigSchema.safeParse({ timelineColumnId: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scale).toBe("week");
    }
  });

  it("rejects an invalid scale value", () => {
    const result = TimelineConfigSchema.safeParse({
      timelineColumnId: null,
      scale: "decade",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DashboardConfigSchema
// ---------------------------------------------------------------------------

describe("DashboardConfigSchema", () => {
  it("parses a well-formed dashboard config with an empty layout and widgets", () => {
    const result = DashboardConfigSchema.safeParse({ layout: [], widgets: {} });
    expect(result.success).toBe(true);
  });

  it("parses a dashboard config with a number widget", () => {
    const result = DashboardConfigSchema.safeParse({
      layout: [{ i: "w1", x: 0, y: 0, w: 4, h: 2 }],
      widgets: {
        w1: {
          kind: "number",
          columnId: VALID_UUID,
          aggregation: "sum",
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("applies defaults (empty layout + widgets) when given an empty object", () => {
    const result = DashboardConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.layout).toEqual([]);
      expect(result.data.widgets).toEqual({});
    }
  });

  it("rejects a widget with an unknown kind", () => {
    const result = DashboardConfigSchema.safeParse({
      layout: [],
      widgets: {
        w1: { kind: "scatter", columnId: VALID_UUID },
      },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FormConfigSchema
// ---------------------------------------------------------------------------

describe("FormConfigSchema", () => {
  it("parses a well-formed form config", () => {
    const result = FormConfigSchema.safeParse({
      targetGroupId: VALID_UUID,
      fields: [{ columnId: VALID_UUID, required: true }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fields).toHaveLength(1);
      expect(result.data.fields[0].required).toBe(true);
    }
  });

  it("applies defaults (targetGroupId = null, empty fields) when given empty object", () => {
    const result = FormConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetGroupId).toBeNull();
      expect(result.data.fields).toEqual([]);
    }
  });

  it("rejects a field with a non-UUID columnId", () => {
    const result = FormConfigSchema.safeParse({
      fields: [{ columnId: "not-a-uuid", required: false }],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ViewConfigSchema — per-kind integration
// ---------------------------------------------------------------------------

describe("ViewConfigSchema per-kind integration", () => {
  it("accepts a kanban sub-config under the 'kanban' key", () => {
    const result = ViewConfigSchema.safeParse({
      kanban: { groupByColumnId: VALID_UUID },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kanban?.groupByColumnId).toBe(VALID_UUID);
    }
  });

  it("accepts a calendar sub-config", () => {
    const result = ViewConfigSchema.safeParse({
      calendar: { dateColumnId: VALID_UUID, viewMode: "day" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a timeline sub-config", () => {
    const result = ViewConfigSchema.safeParse({
      timeline: { timelineColumnId: VALID_UUID, scale: "quarter" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a dashboard sub-config", () => {
    const result = ViewConfigSchema.safeParse({
      dashboard: { layout: [], widgets: {} },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a form sub-config", () => {
    const result = ViewConfigSchema.safeParse({
      form: { fields: [] },
    });
    expect(result.success).toBe(true);
  });

  it("falls back to {} when a malformed kanban config is provided", () => {
    // parseViewConfig falls back to {} on any schema failure.
    const result = parseViewConfig({
      kanban: { groupByColumnId: "not-a-uuid-or-null" },
    });
    // The entire ViewConfigSchema fails (kanban sub-schema rejects), so {} is returned.
    expect(result).toEqual({});
  });

  it("returns the parsed config on a valid per-kind input", () => {
    const result = parseViewConfig({
      kanban: { groupByColumnId: null },
      density: "compact",
    });
    expect(result.density).toBe("compact");
    expect(result.kanban?.groupByColumnId).toBeNull();
  });
});
