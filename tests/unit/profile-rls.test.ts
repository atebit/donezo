// @ts-expect-error vitest is wired in epic 15
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateProfileRow } from "../../lib/auth/profile";

/**
 * Tests for lib/auth/profile.ts — updateProfileRow count-check guard.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * They are written here so the epic 15 executor can pick them up without changes.
 *
 * Mocks:
 * - @/lib/supabase/server: createClient returns a fake SupabaseClient with a
 *   chainable .from().update().eq() interface whose resolved value is controlled
 *   per-test via updateFn.
 */

const updateFn = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: updateFn,
      })),
    })),
  })),
}));

describe("updateProfileRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves without throwing when count > 0 (update succeeded)", async () => {
    updateFn.mockResolvedValue({ error: null, count: 1 });

    await expect(
      updateProfileRow("user-uuid-1", { display_name: "Alice" }),
    ).resolves.toBeUndefined();
  });

  it("throws { code: 'FORBIDDEN' } when count === 0 (RLS denied — no rows updated)", async () => {
    updateFn.mockResolvedValue({ error: null, count: 0 });

    await expect(updateProfileRow("user-uuid-1", { display_name: "Alice" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Not allowed",
    });
  });

  it("throws { code: 'DB' } when the supabase call returns an error", async () => {
    updateFn.mockResolvedValue({ error: { message: "connection refused" }, count: null });

    await expect(updateProfileRow("user-uuid-1", { display_name: "Alice" })).rejects.toMatchObject({
      code: "DB",
      message: "connection refused",
    });
  });
});
