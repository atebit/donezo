/**
 * form-schema.test.ts
 *
 * Unit tests for SubmitFormSchema (lib/validations/form.ts).
 * Verifies valid and invalid submit shapes.
 */

import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import { SubmitFormSchema } from "@/lib/validations/form";

const VALID_UUID = "00000000-0000-4000-8000-000000000001";
const VALID_UUID_2 = "00000000-0000-4000-8000-000000000002";
const VALID_UUID_3 = "00000000-0000-4000-8000-000000000003";

describe("SubmitFormSchema", () => {
  // -----------------------------------------------------------------------
  // Valid cases
  // -----------------------------------------------------------------------

  it("parses a valid submission with one field", () => {
    const input = {
      boardId: VALID_UUID,
      viewId: VALID_UUID_2,
      values: [
        { columnId: VALID_UUID_3, value: "Hello world" },
      ],
    };

    const result = SubmitFormSchema.parse(input);

    expect(result.boardId).toBe(VALID_UUID);
    expect(result.viewId).toBe(VALID_UUID_2);
    expect(result.values).toHaveLength(1);
    expect(result.values[0]?.columnId).toBe(VALID_UUID_3);
    expect(result.values[0]?.value).toBe("Hello world");
  });

  it("parses a valid submission with multiple fields", () => {
    const input = {
      boardId: VALID_UUID,
      viewId: VALID_UUID_2,
      values: [
        { columnId: VALID_UUID_3, value: "text value" },
        { columnId: "00000000-0000-4000-8000-000000000004", value: 42 },
        { columnId: "00000000-0000-4000-8000-000000000005", value: true },
        { columnId: "00000000-0000-4000-8000-000000000006", value: null },
      ],
    };

    const result = SubmitFormSchema.parse(input);

    expect(result.values).toHaveLength(4);
    expect(result.values[1]?.value).toBe(42);
    expect(result.values[2]?.value).toBe(true);
    expect(result.values[3]?.value).toBeNull();
  });

  it("parses a valid submission with an empty values array", () => {
    const input = {
      boardId: VALID_UUID,
      viewId: VALID_UUID_2,
      values: [],
    };

    const result = SubmitFormSchema.parse(input);

    expect(result.values).toHaveLength(0);
  });

  it("accepts object values (e.g., jsonb cell types like person)", () => {
    const input = {
      boardId: VALID_UUID,
      viewId: VALID_UUID_2,
      values: [
        { columnId: VALID_UUID_3, value: { userIds: [VALID_UUID] } },
      ],
    };

    const result = SubmitFormSchema.parse(input);

    expect(result.values[0]?.value).toEqual({ userIds: [VALID_UUID] });
  });

  it("accepts array values (e.g., tags multi-select)", () => {
    const input = {
      boardId: VALID_UUID,
      viewId: VALID_UUID_2,
      values: [
        { columnId: VALID_UUID_3, value: ["tag-1", "tag-2"] },
      ],
    };

    const result = SubmitFormSchema.parse(input);

    expect(result.values[0]?.value).toEqual(["tag-1", "tag-2"]);
  });

  // -----------------------------------------------------------------------
  // Invalid cases — boardId
  // -----------------------------------------------------------------------

  it("rejects a non-UUID boardId", () => {
    const input = {
      boardId: "not-a-uuid",
      viewId: VALID_UUID_2,
      values: [],
    };

    expect(() => SubmitFormSchema.parse(input)).toThrow(ZodError);
  });

  it("rejects a missing boardId", () => {
    const input = {
      viewId: VALID_UUID_2,
      values: [],
    };

    expect(() => SubmitFormSchema.parse(input)).toThrow(ZodError);
  });

  // -----------------------------------------------------------------------
  // Invalid cases — viewId
  // -----------------------------------------------------------------------

  it("rejects a non-UUID viewId", () => {
    const input = {
      boardId: VALID_UUID,
      viewId: "not-a-uuid",
      values: [],
    };

    expect(() => SubmitFormSchema.parse(input)).toThrow(ZodError);
  });

  it("rejects a missing viewId", () => {
    const input = {
      boardId: VALID_UUID,
      values: [],
    };

    expect(() => SubmitFormSchema.parse(input)).toThrow(ZodError);
  });

  // -----------------------------------------------------------------------
  // Invalid cases — values array
  // -----------------------------------------------------------------------

  it("rejects a non-UUID columnId in values", () => {
    const input = {
      boardId: VALID_UUID,
      viewId: VALID_UUID_2,
      values: [
        { columnId: "not-a-uuid", value: "hello" },
      ],
    };

    expect(() => SubmitFormSchema.parse(input)).toThrow(ZodError);
  });

  it("rejects a missing columnId in a values element", () => {
    const input = {
      boardId: VALID_UUID,
      viewId: VALID_UUID_2,
      values: [
        { value: "hello" },
      ],
    };

    expect(() => SubmitFormSchema.parse(input)).toThrow(ZodError);
  });

  it("rejects values that is not an array", () => {
    const input = {
      boardId: VALID_UUID,
      viewId: VALID_UUID_2,
      values: "not-an-array",
    };

    expect(() => SubmitFormSchema.parse(input)).toThrow(ZodError);
  });

  it("rejects entirely missing values field", () => {
    const input = {
      boardId: VALID_UUID,
      viewId: VALID_UUID_2,
    };

    expect(() => SubmitFormSchema.parse(input)).toThrow(ZodError);
  });

  // -----------------------------------------------------------------------
  // safeParse — returns success/failure without throwing
  // -----------------------------------------------------------------------

  it("safeParse returns success=true for a valid input", () => {
    const result = SubmitFormSchema.safeParse({
      boardId: VALID_UUID,
      viewId: VALID_UUID_2,
      values: [{ columnId: VALID_UUID_3, value: "hello" }],
    });

    expect(result.success).toBe(true);
  });

  it("safeParse returns success=false for an invalid input", () => {
    const result = SubmitFormSchema.safeParse({
      boardId: "bad",
      viewId: VALID_UUID_2,
      values: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  // -----------------------------------------------------------------------
  // Type output — ensure the inferred type shape is as expected
  // -----------------------------------------------------------------------

  it("inferred type has values as an array of { columnId: string; value: unknown }", () => {
    const parsed = SubmitFormSchema.parse({
      boardId: VALID_UUID,
      viewId: VALID_UUID_2,
      values: [{ columnId: VALID_UUID_3, value: undefined }],
    });

    // TypeScript inference check — values is an array.
    expect(Array.isArray(parsed.values)).toBe(true);
    // columnId is a string.
    expect(typeof parsed.values[0]?.columnId).toBe("string");
    // value is unknown (undefined in this case, which is treated as undefined).
    expect(parsed.values[0]?.value).toBeUndefined();
  });
});
