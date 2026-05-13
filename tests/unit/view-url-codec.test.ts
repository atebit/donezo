import { describe, expect, it } from "vitest";
import type { FilterTree, SortKey } from "../../lib/views/config-schema";
import {
  decodeFilterTree,
  decodeSortKeys,
  encodeFilterTree,
  encodeSortKeys,
  URL_PARAM_KEYS,
} from "../../lib/views/url-codec";

const UUID1 = "a1b2c3d4-1234-4abc-89ab-000000000001";
const UUID2 = "a1b2c3d4-1234-4abc-89ab-000000000002";

describe("URL_PARAM_KEYS", () => {
  it("exports the expected constant keys", () => {
    expect(URL_PARAM_KEYS.view).toBe("view");
    expect(URL_PARAM_KEYS.filter).toBe("f");
    expect(URL_PARAM_KEYS.sort).toBe("s");
    expect(URL_PARAM_KEYS.groupBy).toBe("g");
    expect(URL_PARAM_KEYS.search).toBe("q");
    expect(URL_PARAM_KEYS.density).toBe("d");
  });
});

describe("encodeFilterTree / decodeFilterTree", () => {
  const simpleTree: FilterTree = {
    kind: "and",
    clauses: [
      {
        kind: "comparison",
        comparison: {
          columnId: UUID1,
          operator: "contains",
          operand: "hello",
        },
      },
    ],
  };

  it("round-trips a simple filter tree", () => {
    const encoded = encodeFilterTree(simpleTree);
    if (encoded == null) throw new Error("encode returned null unexpectedly");
    const decoded = decodeFilterTree(encoded);
    expect(decoded).toEqual(simpleTree);
  });

  it("round-trips a nested OR tree", () => {
    const nestedTree: FilterTree = {
      kind: "and",
      clauses: [
        {
          kind: "or",
          clauses: [
            {
              kind: "comparison",
              comparison: {
                columnId: UUID1,
                operator: "equals",
                operand: "foo",
              },
            },
            {
              kind: "comparison",
              comparison: {
                columnId: UUID2,
                operator: "is_empty",
                operand: null,
              },
            },
          ],
        },
      ],
    };
    const encoded = encodeFilterTree(nestedTree);
    if (encoded == null) throw new Error("encode returned null unexpectedly");
    const decoded = decodeFilterTree(encoded);
    expect(decoded).toEqual(nestedTree);
  });

  it("returns null for garbage input", () => {
    expect(decodeFilterTree("not-valid-base64!!!")).toBeNull();
    expect(decodeFilterTree("")).toBeNull();
    expect(decodeFilterTree("aGVsbG8=")).toBeNull(); // "hello" — valid base64 but invalid JSON for schema
  });

  it("returns null for valid base64 but schema mismatch", () => {
    // Encode a JSON object that doesn't match FilterTree
    const bad = Buffer.from(JSON.stringify({ kind: "nand" }), "utf8").toString("base64url");
    expect(decodeFilterTree(bad)).toBeNull();
  });

  it("is unicode-safe (emoji in operand)", () => {
    const tree: FilterTree = {
      kind: "comparison",
      comparison: {
        columnId: UUID1,
        operator: "contains",
        operand: "café ☕ 日本語",
      },
    };
    const encoded = encodeFilterTree(tree);
    if (encoded == null) throw new Error("encode returned null unexpectedly");
    const decoded = decodeFilterTree(encoded);
    expect(decoded).toEqual(tree);
    // Also verify the operand survived the round-trip
    if (decoded?.kind === "comparison") {
      expect(decoded.comparison.operand).toBe("café ☕ 日本語");
    }
  });

  it("returns null when encoded string exceeds 2 KB", () => {
    // Build a filter tree with a very long operand (>2048 chars when base64-encoded)
    const longOperand = "x".repeat(2000);
    const bigTree: FilterTree = {
      kind: "comparison",
      comparison: { columnId: UUID1, operator: "contains", operand: longOperand },
    };
    const encoded = encodeFilterTree(bigTree);
    expect(encoded).toBeNull();
  });
});

describe("encodeSortKeys / decodeSortKeys", () => {
  const keys: SortKey[] = [
    { columnId: UUID1, direction: "asc" },
    { columnId: UUID2, direction: "desc" },
  ];

  it("round-trips sort keys", () => {
    const encoded = encodeSortKeys(keys);
    if (encoded == null) throw new Error("encode returned null unexpectedly");
    const decoded = decodeSortKeys(encoded);
    expect(decoded).toEqual(keys);
  });

  it("returns null for garbage input", () => {
    expect(decodeSortKeys("garbage")).toBeNull();
  });

  it("returns null for schema mismatch (direction invalid)", () => {
    const bad = Buffer.from(
      JSON.stringify([{ columnId: UUID1, direction: "sideways" }]),
      "utf8",
    ).toString("base64url");
    expect(decodeSortKeys(bad)).toBeNull();
  });

  it("round-trips a single key", () => {
    const single: SortKey[] = [{ columnId: UUID1, direction: "desc" }];
    const encoded = encodeSortKeys(single);
    if (encoded == null) throw new Error("encode returned null unexpectedly");
    const decoded = decodeSortKeys(encoded);
    expect(decoded).toEqual(single);
  });
});
