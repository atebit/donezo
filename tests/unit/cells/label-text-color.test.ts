import { describe, expect, it } from "vitest";
import { labelTextColor, relativeLuminance } from "@/lib/cells/label-text-color";

describe("labelTextColor", () => {
  // Palette colors that need black text (luminance > 0.179)
  it("returns #000000 for #00c875 (green palette)", () => {
    expect(labelTextColor("#00c875")).toBe("#000000");
  });

  it("returns #000000 for #ffcb00 (yellow palette)", () => {
    expect(labelTextColor("#ffcb00")).toBe("#000000");
  });

  it("returns #000000 for #579bfc (blue/pending palette)", () => {
    expect(labelTextColor("#579bfc")).toBe("#000000");
  });

  it("returns #000000 for #c4c4c4 (gray palette)", () => {
    expect(labelTextColor("#c4c4c4")).toBe("#000000");
  });

  it("returns #000000 for #fdab3d (orange palette)", () => {
    expect(labelTextColor("#fdab3d")).toBe("#000000");
  });

  it("returns #000000 for #e2445c (red palette)", () => {
    expect(labelTextColor("#e2445c")).toBe("#000000");
  });

  it("returns #000000 for #a25ddc (purple palette)", () => {
    expect(labelTextColor("#a25ddc")).toBe("#000000");
  });

  // Critical swatch — dark background, needs white text
  it("returns #ffffff for #333333 (critical palette)", () => {
    expect(labelTextColor("#333333")).toBe("#ffffff");
  });

  // Pure black / white
  it("returns #ffffff for #000000 (pure black)", () => {
    expect(labelTextColor("#000000")).toBe("#ffffff");
  });

  it("returns #000000 for #ffffff (pure white)", () => {
    expect(labelTextColor("#ffffff")).toBe("#000000");
  });

  // Shorthand uppercase
  it("returns #000000 for #FFF (shorthand, uppercase)", () => {
    expect(labelTextColor("#FFF")).toBe("#000000");
  });

  // Invalid inputs — safe default
  it("returns #000000 for 'not-a-color' (invalid input)", () => {
    expect(labelTextColor("not-a-color")).toBe("#000000");
  });

  it("returns #000000 for '' (empty string)", () => {
    expect(labelTextColor("")).toBe("#000000");
  });
});

describe("relativeLuminance", () => {
  it("returns approximately 1.0 for #ffffff (pure white)", () => {
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1.0, 3);
  });

  it("returns approximately 0.0 for #000000 (pure black)", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0.0, 3);
  });
});
