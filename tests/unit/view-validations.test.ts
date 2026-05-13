// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it } from "vitest";

/**
 * Unit tests for view Zod validation schemas.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * Written now so epic 15 executor can pick them up without changes.
 */

import {
  CreateViewSchema,
  DeleteViewSchema,
  DuplicateViewSchema,
  GlobalSearchSchema,
  RenameViewSchema,
  SaveViewSchema,
  SetLastViewSchema,
} from "../../lib/validations/view";

const VALID_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const VALID_UUID_2 = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";

// ---------------------------------------------------------------------------
// CreateViewSchema
// ---------------------------------------------------------------------------

describe.skip("CreateViewSchema", () => {
  it("accepts a minimal valid personal view", () => {
    const result = CreateViewSchema.safeParse({
      boardId: VALID_UUID,
      name: "My view",
      kind: "table",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isShared).toBe(false);
      expect(result.data.config).toEqual({});
    }
  });

  it("accepts a shared view with explicit config", () => {
    const result = CreateViewSchema.safeParse({
      boardId: VALID_UUID,
      name: "Main table",
      kind: "table",
      isShared: true,
      config: { density: "compact" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isShared).toBe(true);
      expect(result.data.config.density).toBe("compact");
    }
  });

  it("rejects a non-UUID boardId", () => {
    const result = CreateViewSchema.safeParse({
      boardId: "not-a-uuid",
      name: "My view",
      kind: "table",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("boardId");
    }
  });

  it("rejects an empty name", () => {
    const result = CreateViewSchema.safeParse({
      boardId: VALID_UUID,
      name: "",
      kind: "table",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("name");
    }
  });

  it("rejects a name over 120 characters", () => {
    const result = CreateViewSchema.safeParse({
      boardId: VALID_UUID,
      name: "x".repeat(121),
      kind: "table",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("name");
    }
  });

  it("rejects an unknown view kind", () => {
    const result = CreateViewSchema.safeParse({
      boardId: VALID_UUID,
      name: "My view",
      kind: "grid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("kind");
    }
  });

  it("accepts all valid view kinds", () => {
    const kinds = ["table", "kanban", "calendar", "timeline", "dashboard", "form"] as const;
    for (const kind of kinds) {
      const result = CreateViewSchema.safeParse({
        boardId: VALID_UUID,
        name: "My view",
        kind,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts exactly 120 character name (boundary)", () => {
    const result = CreateViewSchema.safeParse({
      boardId: VALID_UUID,
      name: "x".repeat(120),
      kind: "table",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SaveViewSchema
// ---------------------------------------------------------------------------

describe.skip("SaveViewSchema", () => {
  it("accepts a valid save request with empty config", () => {
    const result = SaveViewSchema.safeParse({
      viewId: VALID_UUID,
      config: {},
    });
    expect(result.success).toBe(true);
  });

  it("accepts a config with sort keys", () => {
    const result = SaveViewSchema.safeParse({
      viewId: VALID_UUID,
      config: {
        sort: [{ columnId: VALID_UUID, direction: "asc" }],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID viewId", () => {
    const result = SaveViewSchema.safeParse({
      viewId: "not-a-uuid",
      config: {},
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("viewId");
    }
  });

  it("rejects an invalid density in config", () => {
    const result = SaveViewSchema.safeParse({
      viewId: VALID_UUID,
      config: { density: "huge" },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RenameViewSchema
// ---------------------------------------------------------------------------

describe.skip("RenameViewSchema", () => {
  it("accepts a valid rename request", () => {
    const result = RenameViewSchema.safeParse({
      viewId: VALID_UUID,
      name: "Renamed view",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID viewId", () => {
    const result = RenameViewSchema.safeParse({
      viewId: "bad-id",
      name: "Renamed view",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("viewId");
    }
  });

  it("rejects an empty name", () => {
    const result = RenameViewSchema.safeParse({
      viewId: VALID_UUID,
      name: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("name");
    }
  });

  it("rejects a name over 120 chars", () => {
    const result = RenameViewSchema.safeParse({
      viewId: VALID_UUID,
      name: "a".repeat(121),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("name");
    }
  });
});

// ---------------------------------------------------------------------------
// DuplicateViewSchema
// ---------------------------------------------------------------------------

describe.skip("DuplicateViewSchema", () => {
  it("accepts a valid UUID", () => {
    const result = DuplicateViewSchema.safeParse({ viewId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID", () => {
    const result = DuplicateViewSchema.safeParse({ viewId: "not-a-uuid" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("viewId");
    }
  });

  it("rejects missing viewId", () => {
    const result = DuplicateViewSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DeleteViewSchema
// ---------------------------------------------------------------------------

describe.skip("DeleteViewSchema", () => {
  it("accepts a valid UUID", () => {
    const result = DeleteViewSchema.safeParse({ viewId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID", () => {
    const result = DeleteViewSchema.safeParse({ viewId: "bad-id" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SetLastViewSchema
// ---------------------------------------------------------------------------

describe.skip("SetLastViewSchema", () => {
  it("accepts valid boardId and viewId", () => {
    const result = SetLastViewSchema.safeParse({
      boardId: VALID_UUID,
      viewId: VALID_UUID_2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID boardId", () => {
    const result = SetLastViewSchema.safeParse({
      boardId: "not-a-uuid",
      viewId: VALID_UUID,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("boardId");
    }
  });

  it("rejects a non-UUID viewId", () => {
    const result = SetLastViewSchema.safeParse({
      boardId: VALID_UUID,
      viewId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("viewId");
    }
  });

  it("rejects missing fields", () => {
    expect(SetLastViewSchema.safeParse({}).success).toBe(false);
    expect(SetLastViewSchema.safeParse({ boardId: VALID_UUID }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GlobalSearchSchema
// ---------------------------------------------------------------------------

describe.skip("GlobalSearchSchema", () => {
  it("accepts a valid search request", () => {
    const result = GlobalSearchSchema.safeParse({
      workspaceId: VALID_UUID,
      q: "hello",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID workspaceId", () => {
    const result = GlobalSearchSchema.safeParse({
      workspaceId: "not-a-uuid",
      q: "hello",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("workspaceId");
    }
  });

  it("rejects an empty query string", () => {
    const result = GlobalSearchSchema.safeParse({
      workspaceId: VALID_UUID,
      q: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("q");
    }
  });

  it("rejects a query over 200 characters", () => {
    const result = GlobalSearchSchema.safeParse({
      workspaceId: VALID_UUID,
      q: "x".repeat(201),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("q");
    }
  });

  it("accepts exactly 200 characters (boundary)", () => {
    const result = GlobalSearchSchema.safeParse({
      workspaceId: VALID_UUID,
      q: "x".repeat(200),
    });
    expect(result.success).toBe(true);
  });
});
