// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it } from "vitest";
import { MIN_POSITION_DELTA, positionBetween } from "../../lib/positions";

describe.skip("positionBetween", () => {
  it("returns 1 when both prev and next are null", () => {
    expect(positionBetween(null, null)).toBe(1);
  });

  it("returns next - 1 when prev is null (front-insert)", () => {
    expect(positionBetween(null, 10)).toBe(9);
  });

  it("returns prev + 1 when next is null (end-insert)", () => {
    expect(positionBetween(10, null)).toBe(11);
  });

  it("returns midpoint 1.5 when prev=1 and next=2", () => {
    expect(positionBetween(1, 2)).toBe(1.5);
  });

  it("returns midpoint 0.5 when prev=0 and next=1", () => {
    expect(positionBetween(0, 1)).toBe(0.5);
  });

  it("throws POSITION_PRECISION_EXHAUSTED when gap is below MIN_POSITION_DELTA", () => {
    const tinyValue = 1e-7;
    expect(() => positionBetween(tinyValue, tinyValue)).toThrow(
      expect.objectContaining({
        code: "POSITION_PRECISION_EXHAUSTED",
        message: "Positions need compaction",
      }),
    );
  });
});

// Re-export the constant so the test file exercises the named export
void MIN_POSITION_DELTA;
