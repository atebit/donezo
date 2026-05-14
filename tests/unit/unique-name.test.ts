import { describe, expect, it } from "vitest";
import { uniqueName } from "@/lib/views/unique-name";

describe("uniqueName", () => {
  it("returns desired when there is no collision", () => {
    expect(uniqueName("Main table", [])).toBe("Main table");
    expect(uniqueName("Main table", ["Other view"])).toBe("Main table");
  });

  it("returns desired (2) on a single collision", () => {
    expect(uniqueName("Main table", ["Main table"])).toBe("Main table (2)");
  });

  it("returns desired (3) when both desired and desired (2) exist", () => {
    expect(uniqueName("Main table", ["Main table", "Main table (2)"])).toBe("Main table (3)");
  });

  it("returns desired (4) when 2 and 3 both exist", () => {
    expect(uniqueName("Main table", ["Main table", "Main table (2)", "Main table (3)"])).toBe(
      "Main table (4)",
    );
  });

  it("fills the smallest gap — skips over existing (3) and picks (2)", () => {
    // Desired = "X", existing has "X" and "X (3)" but NOT "X (2)".
    // Should return "X (2)" (fill from n=2, not skip to n=4).
    expect(uniqueName("X", ["X", "X (3)"])).toBe("X (2)");
  });

  it("does not collide with similarly-named views that differ in content", () => {
    expect(uniqueName("My view", ["Main table", "My view (2)"])).toBe("My view");
  });

  it("handles empty desired string", () => {
    expect(uniqueName("", [""])).toBe(" (2)");
  });
});
