import { describe, expect, it } from "vitest";
import {
  CalendarConfigSchema,
  DashboardConfigSchema,
  defaultConfigForKind,
  FormConfigSchema,
  KanbanConfigSchema,
  parseViewConfig,
  TimelineConfigSchema,
} from "../../lib/views/config-schema";

/**
 * Epic 12 — Slice A
 * view-config-schema-epic12.test.ts
 *
 * Tests round-trip parsing for each per-kind config schema, default values,
 * and the parseViewConfig fallback to {} on invalid input.
 */

const UUID1 = "a1b2c3d4-1234-4abc-89ab-000000000001";
const UUID2 = "a1b2c3d4-1234-4abc-89ab-000000000002";

// ---------------------------------------------------------------------------
// KanbanConfigSchema
// ---------------------------------------------------------------------------

describe("KanbanConfigSchema", () => {
  it("parses an empty object and provides defaults", () => {
    const result = KanbanConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.groupByColumnId).toBeNull();
    }
  });

  it("parses a valid kanban config with a groupByColumnId", () => {
    const result = KanbanConfigSchema.safeParse({ groupByColumnId: UUID1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.groupByColumnId).toBe(UUID1);
    }
  });

  it("parses null groupByColumnId (empty-state marker)", () => {
    const result = KanbanConfigSchema.safeParse({ groupByColumnId: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.groupByColumnId).toBeNull();
    }
  });

  it("parses a kanban config with a full cardStyle", () => {
    const result = KanbanConfigSchema.safeParse({
      groupByColumnId: UUID1,
      cardStyle: {
        showTitle: true,
        visibleColumnIds: [UUID2],
        showAvatars: false,
        showDueDate: true,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cardStyle?.visibleColumnIds).toHaveLength(1);
    }
  });

  it("rejects a non-uuid groupByColumnId", () => {
    const result = KanbanConfigSchema.safeParse({ groupByColumnId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("strips unknown keys (non-strict schema)", () => {
    // swimlaneField is not in the schema; Zod strips it.
    const result = KanbanConfigSchema.safeParse({ swimlaneField: "status" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).swimlaneField).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// CalendarConfigSchema
// ---------------------------------------------------------------------------

describe("CalendarConfigSchema", () => {
  it("parses an empty object and provides defaults", () => {
    const result = CalendarConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.viewMode).toBe("month");
      expect(result.data.dateColumnId).toBeNull();
    }
  });

  it("parses all valid viewMode values", () => {
    for (const mode of ["month", "week", "day", "agenda"] as const) {
      const result = CalendarConfigSchema.safeParse({ viewMode: mode });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an unknown viewMode", () => {
    const result = CalendarConfigSchema.safeParse({ viewMode: "yearly" });
    expect(result.success).toBe(false);
  });

  it("parses a valid dateColumnId", () => {
    const result = CalendarConfigSchema.safeParse({ dateColumnId: UUID1, viewMode: "week" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dateColumnId).toBe(UUID1);
    }
  });

  it("rejects a non-uuid dateColumnId", () => {
    const result = CalendarConfigSchema.safeParse({ dateColumnId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TimelineConfigSchema
// ---------------------------------------------------------------------------

describe("TimelineConfigSchema", () => {
  it("parses an empty object and provides defaults", () => {
    const result = TimelineConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scale).toBe("week");
      expect(result.data.colorBy).toEqual({ kind: "none" });
      expect(result.data.timelineColumnId).toBeNull();
    }
  });

  it("parses all valid scale values", () => {
    for (const scale of ["day", "week", "month", "quarter", "year"] as const) {
      const result = TimelineConfigSchema.safeParse({ scale });
      expect(result.success).toBe(true);
    }
  });

  it("parses colorBy status discriminant", () => {
    const result = TimelineConfigSchema.safeParse({
      colorBy: { kind: "status", columnId: UUID1 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.colorBy.kind).toBe("status");
    }
  });

  it("rejects an unknown colorBy kind", () => {
    const result = TimelineConfigSchema.safeParse({
      colorBy: { kind: "label" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid scale", () => {
    const result = TimelineConfigSchema.safeParse({ scale: "hour" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DashboardConfigSchema
// ---------------------------------------------------------------------------

describe("DashboardConfigSchema", () => {
  it("parses an empty object and provides defaults", () => {
    const result = DashboardConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.layout).toEqual([]);
      expect(result.data.widgets).toEqual({});
    }
  });

  it("parses a valid layout item", () => {
    const result = DashboardConfigSchema.safeParse({
      layout: [{ i: "widget-1", x: 0, y: 0, w: 2, h: 2 }],
      widgets: {
        "widget-1": {
          kind: "number",
          columnId: UUID1,
          aggregation: "count",
          label: "Total tasks",
        },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.layout).toHaveLength(1);
      expect(result.data.widgets["widget-1"]?.kind).toBe("number");
    }
  });

  it("parses a bar widget", () => {
    const result = DashboardConfigSchema.safeParse({
      layout: [],
      widgets: {
        w1: { kind: "bar", xColumnId: UUID1, yAggregation: "count" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("parses a pie widget", () => {
    const result = DashboardConfigSchema.safeParse({
      layout: [],
      widgets: {
        w1: { kind: "pie", columnId: UUID1, aggregation: "sum" },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a widget with an unknown kind", () => {
    const result = DashboardConfigSchema.safeParse({
      layout: [],
      widgets: { w1: { kind: "heatmap" } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects layout items with negative coordinates", () => {
    const result = DashboardConfigSchema.safeParse({
      layout: [{ i: "w1", x: -1, y: 0, w: 2, h: 2 }],
      widgets: {},
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FormConfigSchema
// ---------------------------------------------------------------------------

describe("FormConfigSchema", () => {
  it("parses an empty object and provides defaults", () => {
    const result = FormConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.submitLabel).toBe("Submit");
      expect(result.data.successMessage).toBe("Submitted!");
      expect(result.data.fields).toEqual([]);
      expect(result.data.targetGroupId).toBeNull();
    }
  });

  it("parses a form config with fields", () => {
    const result = FormConfigSchema.safeParse({
      targetGroupId: UUID1,
      fields: [
        { columnId: UUID2, required: true, labelOverride: "Email", helpText: "Enter your email" },
      ],
      submitLabel: "Send",
      successMessage: "Thank you!",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fields).toHaveLength(1);
      expect(result.data.fields[0]?.required).toBe(true);
    }
  });

  it("rejects a form field with a non-uuid columnId", () => {
    const result = FormConfigSchema.safeParse({
      fields: [{ columnId: "not-a-uuid", required: false }],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// defaultConfigForKind
// ---------------------------------------------------------------------------

describe("defaultConfigForKind", () => {
  it("returns {} for table kind", () => {
    expect(defaultConfigForKind("table")).toEqual({});
  });

  it("returns kanban defaults with groupByColumnId: null", () => {
    const config = defaultConfigForKind("kanban");
    expect((config as { groupByColumnId: null }).groupByColumnId).toBeNull();
  });

  it("returns calendar defaults with viewMode: 'month'", () => {
    const config = defaultConfigForKind("calendar");
    expect((config as { viewMode: string }).viewMode).toBe("month");
  });

  it("returns timeline defaults with scale: 'week'", () => {
    const config = defaultConfigForKind("timeline");
    expect((config as { scale: string }).scale).toBe("week");
  });

  it("returns dashboard defaults with empty layout and widgets", () => {
    const config = defaultConfigForKind("dashboard");
    expect((config as { layout: unknown[] }).layout).toEqual([]);
    expect((config as { widgets: Record<string, unknown> }).widgets).toEqual({});
  });

  it("returns form defaults with empty fields array", () => {
    const config = defaultConfigForKind("form");
    expect((config as { fields: unknown[] }).fields).toEqual([]);
  });

  it("returns {} for unknown kind", () => {
    expect(defaultConfigForKind("unknown")).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// parseViewConfig — Epic 12 per-kind sub-config integration
// ---------------------------------------------------------------------------

describe("parseViewConfig — Epic 12 per-kind integration", () => {
  it("returns {} when kanban sub-config has an invalid groupByColumnId", () => {
    expect(parseViewConfig({ kanban: { groupByColumnId: "not-a-uuid" } })).toEqual({});
  });

  it("accepts a valid kanban sub-config embedded in a full ViewConfig", () => {
    const result = parseViewConfig({ kanban: { groupByColumnId: UUID1 } });
    expect((result as Record<string, unknown>).kanban).toBeDefined();
  });

  it("accepts an empty kanban sub-config (triggers defaults)", () => {
    const result = parseViewConfig({ kanban: {} });
    expect((result as Record<string, unknown>).kanban).toBeDefined();
  });

  it("accepts a valid calendar sub-config", () => {
    const result = parseViewConfig({ calendar: { dateColumnId: UUID1, viewMode: "week" } });
    expect((result as Record<string, unknown>).calendar).toBeDefined();
  });

  it("returns {} when calendar viewMode is invalid", () => {
    expect(parseViewConfig({ calendar: { viewMode: "fortnight" } })).toEqual({});
  });

  it("accepts a valid timeline sub-config", () => {
    const result = parseViewConfig({ timeline: { scale: "month" } });
    expect((result as Record<string, unknown>).timeline).toBeDefined();
  });

  it("accepts a valid dashboard sub-config with an empty layout", () => {
    const result = parseViewConfig({ dashboard: { layout: [], widgets: {} } });
    expect((result as Record<string, unknown>).dashboard).toBeDefined();
  });

  it("accepts a valid form sub-config with no fields", () => {
    const result = parseViewConfig({ form: { fields: [] } });
    expect((result as Record<string, unknown>).form).toBeDefined();
  });
});
