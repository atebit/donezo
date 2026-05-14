/**
 * Unit tests for AggregateRender + related aggregation descriptor logic.
 *
 * Tests cover every AggregateRenderDescriptor kind:
 *   - text
 *   - count_non_empty
 *   - label_distribution
 *   - date_range
 *   - percent_checked
 *   - unique_count_avatars
 *
 * We also test the pure aggregation logic from def.ts files that return
 * descriptors to ensure correctness of descriptor shapes.
 *
 * Epic 16 (Slice C).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AggregateRender } from "@/components/board/table/AggregateRender";
import type { AggregateRenderDescriptor } from "@/lib/cells/aggregate-descriptors";

// ---------------------------------------------------------------------------
// AggregateRender component — one describe block per descriptor kind
// ---------------------------------------------------------------------------

describe("AggregateRender", () => {
  describe('kind: "text"', () => {
    it("renders the value string", () => {
      const d: AggregateRenderDescriptor = { kind: "text", value: "42" };
      render(<AggregateRender descriptor={d} />);
      expect(screen.getByText("42")).toBeInTheDocument();
    });

    it("renders an empty string without crashing", () => {
      const d: AggregateRenderDescriptor = { kind: "text", value: "" };
      const { container } = render(<AggregateRender descriptor={d} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('kind: "count_non_empty"', () => {
    it("renders N / M format", () => {
      const d: AggregateRenderDescriptor = { kind: "count_non_empty", nonEmpty: 3, total: 5 };
      const { container } = render(<AggregateRender descriptor={d} />);
      // The outer span has "3" and an inner span has " / 5"; use textContent
      const outerSpan = container.querySelector("span");
      expect(outerSpan?.textContent).toBe("3 / 5");
    });

    it("renders 0 / N when nothing is filled", () => {
      const d: AggregateRenderDescriptor = { kind: "count_non_empty", nonEmpty: 0, total: 4 };
      const { container } = render(<AggregateRender descriptor={d} />);
      const outerSpan = container.querySelector("span");
      expect(outerSpan?.textContent).toBe("0 / 4");
    });
  });

  describe('kind: "label_distribution"', () => {
    it("renders a colored bar with correct segment widths", () => {
      const d: AggregateRenderDescriptor = {
        kind: "label_distribution",
        segments: [
          { labelId: "done", count: 6, color: "#00c875", name: "Done" },
          { labelId: "stuck", count: 2, color: "#e2445c", name: "Stuck" },
          { labelId: "wip", count: 2, color: "#fdab3d", name: "WIP" },
        ],
      };
      render(<AggregateRender descriptor={d} />);
      const bar = screen.getByRole("img");
      expect(bar).toBeInTheDocument();
      // Should have 3 segment divs as children
      const children = bar.children;
      expect(children).toHaveLength(3);
      // First segment should be 60% wide
      expect((children[0] as HTMLElement).style.width).toBe("60%");
      // jsdom normalizes hex to rgb() — check that the element has a background color set
      // (exact color format is browser/jsdom dependent; verify presence rather than exact value)
      expect((children[0] as HTMLElement).style.backgroundColor).not.toBe("");
    });

    it("renders a dash when there are no segments", () => {
      const d: AggregateRenderDescriptor = {
        kind: "label_distribution",
        segments: [],
      };
      render(<AggregateRender descriptor={d} />);
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("includes aria-label with percentage info", () => {
      const d: AggregateRenderDescriptor = {
        kind: "label_distribution",
        segments: [
          { labelId: "done", count: 1, color: "#00c875", name: "Done" },
          { labelId: "stuck", count: 1, color: "#e2445c", name: "Stuck" },
        ],
      };
      render(<AggregateRender descriptor={d} />);
      const bar = screen.getByRole("img");
      expect(bar.getAttribute("aria-label")).toMatch(/Done: 50%/);
      expect(bar.getAttribute("aria-label")).toMatch(/Stuck: 50%/);
    });
  });

  describe('kind: "date_range"', () => {
    it("renders a formatted date range", () => {
      const d: AggregateRenderDescriptor = {
        kind: "date_range",
        min: "2026-01-01",
        max: "2026-12-31",
      };
      render(<AggregateRender descriptor={d} />);
      // The text should contain a dash-separated range
      const el = screen.getByText(/–/);
      expect(el).toBeInTheDocument();
    });

    it("renders a dash when both min and max are null", () => {
      const d: AggregateRenderDescriptor = { kind: "date_range", min: null, max: null };
      render(<AggregateRender descriptor={d} />);
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("renders a single date when min equals max", () => {
      const d: AggregateRenderDescriptor = {
        kind: "date_range",
        min: "2026-05-13",
        max: "2026-05-13",
      };
      render(<AggregateRender descriptor={d} />);
      // Should not show a range separator when dates are equal
      const el = screen.queryByText(/–/);
      expect(el).toBeNull();
    });
  });

  describe('kind: "percent_checked"', () => {
    it("renders rounded percentage", () => {
      const d: AggregateRenderDescriptor = { kind: "percent_checked", pct: 66.6, total: 3 };
      render(<AggregateRender descriptor={d} />);
      expect(screen.getByText("67%")).toBeInTheDocument();
    });

    it("renders 0% when nothing is checked", () => {
      const d: AggregateRenderDescriptor = { kind: "percent_checked", pct: 0, total: 5 };
      render(<AggregateRender descriptor={d} />);
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("renders a dash when total is 0", () => {
      const d: AggregateRenderDescriptor = { kind: "percent_checked", pct: 0, total: 0 };
      render(<AggregateRender descriptor={d} />);
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  describe('kind: "unique_count_avatars"', () => {
    it("renders a dash when count is 0 (empty state)", () => {
      const d: AggregateRenderDescriptor = {
        kind: "unique_count_avatars",
        count: 0,
        userIds: [],
      };
      render(<AggregateRender descriptor={d} />);
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("renders 1 avatar and count=1 for a single userId", () => {
      const d: AggregateRenderDescriptor = {
        kind: "unique_count_avatars",
        count: 1,
        userIds: ["user-a"],
      };
      const { container } = render(<AggregateRender descriptor={d} />);
      // Container should have the accessible role="img" wrapper
      const wrapper = container.querySelector("[role='img']");
      expect(wrapper).toBeInTheDocument();
      expect(wrapper?.getAttribute("aria-label")).toBe("1 person");
      // Count text should be visible
      expect(screen.getByText("1")).toBeInTheDocument();
      // No overflow chip (only 1 user, no +N)
      expect(screen.queryByText(/^\+\d+/)).toBeNull();
    });

    it("renders 2 avatars and count=2 with no overflow chip", () => {
      const d: AggregateRenderDescriptor = {
        kind: "unique_count_avatars",
        count: 2,
        userIds: ["user-a", "user-b"],
      };
      const { container } = render(<AggregateRender descriptor={d} />);
      const wrapper = container.querySelector("[role='img']");
      expect(wrapper?.getAttribute("aria-label")).toBe("2 people");
      expect(screen.getByText("2")).toBeInTheDocument();
      // Exactly 2 Avatar elements (role="img" is on Avatar spans and the outer div)
      // The outer div is role="img"; Avatar fallback spans are also role="img" — count inner ones
      const allImgRoles = container.querySelectorAll("[role='img']");
      // outer wrapper (1) + 2 avatars = 3
      expect(allImgRoles).toHaveLength(3);
      expect(screen.queryByText(/^\+\d+/)).toBeNull();
    });

    it("renders 3 avatars and count=3 with no overflow chip", () => {
      const d: AggregateRenderDescriptor = {
        kind: "unique_count_avatars",
        count: 3,
        userIds: ["user-a", "user-b", "user-c"],
      };
      const { container } = render(<AggregateRender descriptor={d} />);
      expect(screen.getByText("3")).toBeInTheDocument();
      // 3 avatars, no +N chip
      const allImgRoles = container.querySelectorAll("[role='img']");
      // outer wrapper (1) + 3 avatars = 4
      expect(allImgRoles).toHaveLength(4);
      expect(screen.queryByText(/^\+\d+/)).toBeNull();
    });

    it("renders 3 avatars + +1 overflow chip + count=4 for 4 userIds", () => {
      const d: AggregateRenderDescriptor = {
        kind: "unique_count_avatars",
        count: 4,
        userIds: ["user-a", "user-b", "user-c", "user-d"],
      };
      const { container } = render(<AggregateRender descriptor={d} />);
      expect(screen.getByText("4")).toBeInTheDocument();
      // Only 3 avatars rendered (slice 0..3)
      const allImgRoles = container.querySelectorAll("[role='img']");
      // outer wrapper (1) + 3 avatars = 4 (overflow chip has no role="img")
      expect(allImgRoles).toHaveLength(4);
      // +1 overflow chip
      expect(screen.getByText("+1")).toBeInTheDocument();
    });

    it("renders 3 avatars + +2 overflow chip + count=5 for 5 userIds", () => {
      const d: AggregateRenderDescriptor = {
        kind: "unique_count_avatars",
        count: 5,
        userIds: ["u1", "u2", "u3", "u4", "u5"],
      };
      render(<AggregateRender descriptor={d} />);
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("+2")).toBeInTheDocument();
    });

    it("renders pluralized aria-label for multiple people", () => {
      const d: AggregateRenderDescriptor = {
        kind: "unique_count_avatars",
        count: 2,
        userIds: ["u1", "u2"],
      };
      const { container } = render(<AggregateRender descriptor={d} />);
      const wrapper = container.querySelector("[role='img']");
      expect(wrapper?.getAttribute("aria-label")).toBe("2 people");
    });

    it("renders singular aria-label for 1 person", () => {
      const d: AggregateRenderDescriptor = {
        kind: "unique_count_avatars",
        count: 1,
        userIds: ["u1"],
      };
      const { container } = render(<AggregateRender descriptor={d} />);
      const wrapper = container.querySelector("[role='img']");
      expect(wrapper?.getAttribute("aria-label")).toBe("1 person");
    });
  });
});

// ---------------------------------------------------------------------------
// Aggregation descriptor logic — pure tests (no rendering)
// ---------------------------------------------------------------------------

describe("def.aggregate descriptor output", () => {
  describe("status / priority — percent_by_label", () => {
    it("returns a label_distribution descriptor with correct segments", async () => {
      const { statusType } = await import("@/components/cells/status/def");
      const values = [{ labelId: "done" }, { labelId: "done" }, { labelId: "stuck" }, null];
      const labels = [
        { id: "done", name: "Done", color: "#00c875" },
        { id: "stuck", name: "Stuck", color: "#e2445c" },
      ];
      // biome-ignore lint/suspicious/noExplicitAny: test-only cast for heterogeneous CellTypeDef generics
      const result = statusType.aggregate(values as any, "percent_by_label", {
        _labels: labels,
        // biome-ignore lint/suspicious/noExplicitAny: test-only cast for heterogeneous CellTypeDef generics
      } as any);

      expect(typeof result).toBe("object");
      const descriptor = result as AggregateRenderDescriptor;
      expect(descriptor.kind).toBe("label_distribution");
      if (descriptor.kind === "label_distribution") {
        expect(descriptor.segments).toHaveLength(2);
        const done = descriptor.segments.find((s) => s.labelId === "done");
        expect(done?.count).toBe(2);
        expect(done?.color).toBe("#00c875");
        expect(done?.name).toBe("Done");
      }
    });

    it("falls back to labelId as name when label not in config", async () => {
      const { statusType } = await import("@/components/cells/status/def");
      const values = [{ labelId: "unknown-id" }];
      // biome-ignore lint/suspicious/noExplicitAny: test-only cast for heterogeneous CellTypeDef generics
      const result = statusType.aggregate(values as any, "percent_by_label", {} as any);
      const descriptor = result as AggregateRenderDescriptor;
      if (descriptor.kind === "label_distribution") {
        expect(descriptor.segments[0]?.name).toBe("unknown-id");
      }
    });

    it("returns string for count kind (backward compat)", async () => {
      const { statusType } = await import("@/components/cells/status/def");
      const values = [{ labelId: "done" }, null];
      // biome-ignore lint/suspicious/noExplicitAny: test-only cast for heterogeneous CellTypeDef generics
      const result = statusType.aggregate(values as any, "count", {} as any);
      expect(typeof result).toBe("string");
      expect(result).toBe("2");
    });
  });

  describe("date — range", () => {
    it("returns a date_range descriptor", async () => {
      const { dateType } = await import("@/components/cells/date/def");
      const values = [{ iso: "2026-01-15" }, { iso: "2026-06-30" }, { iso: "2026-03-10" }];
      // biome-ignore lint/suspicious/noExplicitAny: test-only cast for heterogeneous CellTypeDef generics
      const result = dateType.aggregate(values as any, "range", {} as any);
      const descriptor = result as AggregateRenderDescriptor;
      expect(descriptor.kind).toBe("date_range");
      if (descriptor.kind === "date_range") {
        expect(descriptor.min).toBe("2026-01-15");
        expect(descriptor.max).toBe("2026-06-30");
      }
    });

    it("returns empty date_range descriptor for empty values", async () => {
      const { dateType } = await import("@/components/cells/date/def");
      // biome-ignore lint/suspicious/noExplicitAny: test-only cast for heterogeneous CellTypeDef generics
      const result = dateType.aggregate([], "range", {} as any);
      const descriptor = result as AggregateRenderDescriptor;
      expect(descriptor.kind).toBe("date_range");
      if (descriptor.kind === "date_range") {
        expect(descriptor.min).toBeNull();
        expect(descriptor.max).toBeNull();
      }
    });
  });

  describe("checkbox — percent_checked", () => {
    it("returns a percent_checked descriptor", async () => {
      const { checkboxType } = await import("@/components/cells/checkbox/def");
      const values = [true, false, true, null];
      // biome-ignore lint/suspicious/noExplicitAny: test-only cast for heterogeneous CellTypeDef generics
      const result = checkboxType.aggregate(values as any, "percent_checked", {} as any);
      const descriptor = result as AggregateRenderDescriptor;
      expect(descriptor.kind).toBe("percent_checked");
      if (descriptor.kind === "percent_checked") {
        expect(descriptor.total).toBe(4);
        // 2 checked out of 4 = 50%
        expect(descriptor.pct).toBeCloseTo(50);
      }
    });
  });

  describe("person — count_unique", () => {
    it("returns a unique_count_avatars descriptor", async () => {
      const { personType } = await import("@/components/cells/person/def");
      const values = [{ userIds: ["u1", "u2"] }, { userIds: ["u2", "u3"] }, null];
      // biome-ignore lint/suspicious/noExplicitAny: test-only cast for heterogeneous CellTypeDef generics
      const result = personType.aggregate(values as any, "count_unique", {} as any);
      const descriptor = result as AggregateRenderDescriptor;
      expect(descriptor.kind).toBe("unique_count_avatars");
      if (descriptor.kind === "unique_count_avatars") {
        expect(descriptor.count).toBe(3); // u1, u2, u3
        expect(descriptor.userIds).toContain("u1");
        expect(descriptor.userIds).toContain("u2");
        expect(descriptor.userIds).toContain("u3");
      }
    });
  });

  describe("text — count_non_empty", () => {
    it("returns a count_non_empty descriptor", async () => {
      const { textType } = await import("@/components/cells/text/def");
      const values = ["hello", "", null, "world"];
      // biome-ignore lint/suspicious/noExplicitAny: test-only cast for heterogeneous CellTypeDef generics
      const result = textType.aggregate(values as any, "count_non_empty", {} as any);
      const descriptor = result as AggregateRenderDescriptor;
      expect(descriptor.kind).toBe("count_non_empty");
      if (descriptor.kind === "count_non_empty") {
        expect(descriptor.nonEmpty).toBe(2); // "hello" and "world"
        expect(descriptor.total).toBe(4);
      }
    });
  });

  describe("timeline — range", () => {
    it("returns a date_range descriptor using start/end", async () => {
      const { timelineType } = await import("@/components/cells/timeline/def");
      const values = [
        { start: "2026-01-01", end: "2026-03-31" },
        { start: "2026-04-01", end: "2026-12-31" },
      ];
      // biome-ignore lint/suspicious/noExplicitAny: test-only cast for heterogeneous CellTypeDef generics
      const result = timelineType.aggregate(values as any, "range", {} as any);
      const descriptor = result as AggregateRenderDescriptor;
      expect(descriptor.kind).toBe("date_range");
      if (descriptor.kind === "date_range") {
        expect(descriptor.min).toBe("2026-01-01");
        expect(descriptor.max).toBe("2026-12-31");
      }
    });
  });

  describe("tags — percent_by_label", () => {
    it("returns a label_distribution descriptor using tag strings as labels", async () => {
      const { tagsType } = await import("@/components/cells/tags/def");
      const values = [{ values: ["react", "typescript"] }, { values: ["react"] }, null];
      // biome-ignore lint/suspicious/noExplicitAny: test-only cast for heterogeneous CellTypeDef generics
      const result = tagsType.aggregate(values as any, "percent_by_label", {} as any);
      const descriptor = result as AggregateRenderDescriptor;
      expect(descriptor.kind).toBe("label_distribution");
      if (descriptor.kind === "label_distribution") {
        const react = descriptor.segments.find((s) => s.labelId === "react");
        expect(react?.count).toBe(2);
        expect(react?.name).toBe("react");
        const ts = descriptor.segments.find((s) => s.labelId === "typescript");
        expect(ts?.count).toBe(1);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// defaultAggregation field presence checks
// ---------------------------------------------------------------------------

describe("defaultAggregation field", () => {
  it.each([
    ["status", "percent_by_label"],
    ["priority", "percent_by_label"],
    ["tags", "percent_by_label"],
    ["date", "range"],
    ["timeline", "range"],
    ["number", "sum"],
    ["currency", "sum"],
    ["rating", "sum"],
    ["person", "count_unique"],
    ["checkbox", "percent_checked"],
    ["file", "sum"],
    ["text", "count_non_empty"],
    ["long_text", "count_non_empty"],
    ["email", "count_non_empty"],
    ["phone", "count_non_empty"],
    ["link", "count_non_empty"],
    ["country", "count_non_empty"],
    ["location", "count_non_empty"],
  ] as const)("cell type %s has defaultAggregation %s", async (typeId, expected) => {
    const { getCellDef } = await import("@/lib/cells/registry");
    // biome-ignore lint/suspicious/noExplicitAny: test-only cast to allow string typeId from it.each
    const def = getCellDef(typeId as any);
    expect(def.defaultAggregation).toBe(expected);
  });
});
