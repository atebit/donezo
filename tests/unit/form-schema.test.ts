import { describe, expect, it } from "vitest";
import { SubmitFormSchema } from "../../lib/validations/form";

/**
 * form-schema.test.ts — unit tests for SubmitFormSchema.
 *
 * Epic 12, Slice F — F.6.
 */

const VALID_BOARD_ID = "a1b2c3d4-1234-4abc-89ab-000000000001";
const VALID_VIEW_ID = "a1b2c3d4-1234-4abc-89ab-000000000002";
const VALID_COLUMN_ID = "a1b2c3d4-1234-4abc-89ab-000000000003";

// ---------------------------------------------------------------------------
// Valid inputs
// ---------------------------------------------------------------------------

describe("SubmitFormSchema — valid inputs", () => {
  it("accepts a minimal valid input with empty values array", () => {
    const result = SubmitFormSchema.safeParse({
      boardId: VALID_BOARD_ID,
      viewId: VALID_VIEW_ID,
      values: [],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid input with one value entry", () => {
    const result = SubmitFormSchema.safeParse({
      boardId: VALID_BOARD_ID,
      viewId: VALID_VIEW_ID,
      values: [{ columnId: VALID_COLUMN_ID, value: "Hello" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.values).toHaveLength(1);
      expect(result.data.values[0]?.value).toBe("Hello");
    }
  });

  it("accepts a null value inside the values array (cell with no value)", () => {
    const result = SubmitFormSchema.safeParse({
      boardId: VALID_BOARD_ID,
      viewId: VALID_VIEW_ID,
      values: [{ columnId: VALID_COLUMN_ID, value: null }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts multiple value entries with heterogeneous value types", () => {
    const result = SubmitFormSchema.safeParse({
      boardId: VALID_BOARD_ID,
      viewId: VALID_VIEW_ID,
      values: [
        { columnId: VALID_COLUMN_ID, value: "text" },
        { columnId: "a1b2c3d4-1234-4abc-89ab-000000000004", value: 42 },
        { columnId: "a1b2c3d4-1234-4abc-89ab-000000000005", value: true },
        { columnId: "a1b2c3d4-1234-4abc-89ab-000000000006", value: { label: "Done" } },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.values).toHaveLength(4);
    }
  });
});

// ---------------------------------------------------------------------------
// Invalid inputs
// ---------------------------------------------------------------------------

describe("SubmitFormSchema — invalid inputs", () => {
  it("rejects a non-UUID boardId", () => {
    const result = SubmitFormSchema.safeParse({
      boardId: "not-a-uuid",
      viewId: VALID_VIEW_ID,
      values: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("boardId");
    }
  });

  it("rejects a non-UUID viewId", () => {
    const result = SubmitFormSchema.safeParse({
      boardId: VALID_BOARD_ID,
      viewId: "not-a-uuid",
      values: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("viewId");
    }
  });

  it("rejects a non-UUID columnId inside values", () => {
    const result = SubmitFormSchema.safeParse({
      boardId: VALID_BOARD_ID,
      viewId: VALID_VIEW_ID,
      values: [{ columnId: "bad-id", value: "Hello" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain("columnId");
    }
  });

  it("rejects a missing boardId", () => {
    const result = SubmitFormSchema.safeParse({
      viewId: VALID_VIEW_ID,
      values: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing viewId", () => {
    const result = SubmitFormSchema.safeParse({
      boardId: VALID_BOARD_ID,
      values: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing values array", () => {
    const result = SubmitFormSchema.safeParse({
      boardId: VALID_BOARD_ID,
      viewId: VALID_VIEW_ID,
    });
    expect(result.success).toBe(false);
  });

  it("rejects values as a non-array", () => {
    const result = SubmitFormSchema.safeParse({
      boardId: VALID_BOARD_ID,
      viewId: VALID_VIEW_ID,
      values: "not an array",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a value entry missing columnId", () => {
    const result = SubmitFormSchema.safeParse({
      boardId: VALID_BOARD_ID,
      viewId: VALID_VIEW_ID,
      values: [{ value: "Hello" }],
    });
    expect(result.success).toBe(false);
  });
});
