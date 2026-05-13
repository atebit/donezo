import { describe, expect, it } from "vitest";

import { cursorColorForUser } from "../../lib/realtime/cursor-color";

describe("cursorColorForUser", () => {
  it("returns a stable color for the same user_id", () => {
    const userId = "user-abc-123";
    const color1 = cursorColorForUser(userId);
    const color2 = cursorColorForUser(userId);
    expect(color1).toBe(color2);
  });

  it("returns different colors for distinct user_ids (most of the time)", () => {
    const color1 = cursorColorForUser("user-aaa-111");
    const color2 = cursorColorForUser("user-bbb-222");
    const color3 = cursorColorForUser("user-ccc-333");
    // Not all three should be the same
    const allSame = color1 === color2 && color2 === color3;
    expect(allSame).toBe(false);
  });

  it("never returns a hue in the red band [0, 20]", () => {
    // Test a large set of user_id inputs to confirm no red-band hue appears
    const testIds = [
      "user-0",
      "user-1",
      "user-2",
      "user-10",
      "user-100",
      "abc",
      "xyz",
      "550e8400-e29b-41d4-a716-446655440000",
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "short",
      "a",
      "z",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
      "user-with-very-long-id-that-should-still-hash-correctly",
      "UPPERCASE",
      "MixedCase123",
      "test@example.com",
      "00000000-0000-0000-0000-000000000000",
    ];

    for (const userId of testIds) {
      const color = cursorColorForUser(userId);
      // Parse the hue from "hsl(<h>, 70%, 50%)"
      const match = /^hsl\((\d+(?:\.\d+)?), 70%, 50%\)$/.exec(color);
      expect(match, `Expected HSL format for userId "${userId}", got "${color}"`).toBeTruthy();
      if (match) {
        const hue = Number(match[1]);
        expect(hue, `Hue ${hue} for userId "${userId}" is in the red band [0, 20]`).toBeGreaterThan(
          20,
        );
      }
    }
  });

  it("returns an HSL string with the correct format", () => {
    const color = cursorColorForUser("test-user-id");
    expect(color).toMatch(/^hsl\(\d+, 70%, 50%\)$/);
  });

  it("works for empty string input (edge case)", () => {
    // Should not throw; deterministic
    const color1 = cursorColorForUser("");
    const color2 = cursorColorForUser("");
    expect(color1).toBe(color2);
    expect(color1).toMatch(/^hsl\(\d+, 70%, 50%\)$/);
  });
});
