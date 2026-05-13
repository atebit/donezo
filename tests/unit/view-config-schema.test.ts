// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it } from "vitest";
import {
  DensitySchema,
  type FilterTree,
  FilterTreeSchema,
  GroupBySchema,
  parseViewConfig,
  SortKeySchema,
  type ViewConfig,
  ViewConfigSchema,
} from "../../lib/views/config-schema";

describe("ViewConfigSchema", () => {
  it("parses a valid minimal config (empty object)", () => {
    const result = ViewConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({});
    }
  });

  it("parses a config with sort + density", () => {
    const raw = {
      sort: [{ columnId: "a1b2c3d4-1234-4abc-89ab-000000000001", direction: "asc" }],
      density: "compact",
    };
    const result = ViewConfigSchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.density).toBe("compact");
      expect(result.data.sort).toHaveLength(1);
    }
  });

  it("parses columnVisibility and columnWidths as uuid-keyed records", () => {
    const uuid = "a1b2c3d4-1234-4abc-89ab-000000000001";
    const raw: ViewConfig = {
      columnVisibility: { [uuid]: false },
      columnWidths: { [uuid]: 200 },
    };
    const result = ViewConfigSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid density value", () => {
    const result = DensitySchema.safeParse("tiny");
    expect(result.success).toBe(false);
  });

  it("rejects a malformed groupBy discriminator", () => {
    const result = GroupBySchema.safeParse({ kind: "unknown_kind" });
    expect(result.success).toBe(false);
  });

  it("accepts groupBy native", () => {
    const result = GroupBySchema.safeParse({ kind: "native" });
    expect(result.success).toBe(true);
  });

  it("accepts groupBy column with a uuid", () => {
    const result = GroupBySchema.safeParse({
      kind: "column",
      columnId: "a1b2c3d4-1234-4abc-89ab-000000000001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects groupBy column missing columnId", () => {
    const result = GroupBySchema.safeParse({ kind: "column" });
    expect(result.success).toBe(false);
  });

  it("rejects sortKey with invalid direction", () => {
    const result = SortKeySchema.safeParse({
      columnId: "a1b2c3d4-1234-4abc-89ab-000000000001",
      direction: "random",
    });
    expect(result.success).toBe(false);
  });

  it("parses a nested AND filter tree (recursive)", () => {
    const tree: FilterTree = {
      kind: "and",
      clauses: [
        {
          kind: "comparison",
          comparison: {
            columnId: "a1b2c3d4-1234-4abc-89ab-000000000001",
            operator: "contains",
            operand: "hello",
          },
        },
        {
          kind: "or",
          clauses: [
            {
              kind: "comparison",
              comparison: {
                columnId: "a1b2c3d4-1234-4abc-89ab-000000000002",
                operator: "is_empty",
                operand: null,
              },
            },
          ],
        },
      ],
    };
    const result = FilterTreeSchema.safeParse(tree);
    expect(result.success).toBe(true);
  });

  it("rejects a filter tree with unknown kind", () => {
    const result = FilterTreeSchema.safeParse({ kind: "nand", clauses: [] });
    expect(result.success).toBe(false);
  });

  it("parses reserved Epic 12 slots permissively", () => {
    const raw = {
      kanban: { swimlaneField: "status", cardFields: ["title", "date"] },
      calendar: { dateField: "a1b2c3d4-1234-4abc-89ab-000000000001" },
    };
    const result = ViewConfigSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });
});

describe("parseViewConfig", () => {
  it("returns {} on null input", () => {
    expect(parseViewConfig(null)).toEqual({});
  });

  it("returns {} on completely invalid input", () => {
    expect(parseViewConfig("bad string")).toEqual({});
  });

  it("returns {} when density is invalid", () => {
    expect(parseViewConfig({ density: "ultra_wide" })).toEqual({});
  });

  it("returns the parsed config on valid input", () => {
    const result = parseViewConfig({ density: "spacious" });
    expect(result).toEqual({ density: "spacious" });
  });

  it("returns {} when groupBy discriminator is wrong", () => {
    expect(parseViewConfig({ groupBy: { kind: "bad" } })).toEqual({});
  });
});
