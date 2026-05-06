// @ts-expect-error vitest is wired in epic 15
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for lib/supabase/admin.ts — admin client guard throw paths.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * They are written here so the epic 15 executor can pick them up without changes.
 *
 * Approach:
 * - vi.resetModules() ensures each dynamic import re-evaluates admin.ts fresh.
 * - Dynamic await import() lets us test module-evaluation side-effects
 *   (the `typeof window !== "undefined"` guard that throws at eval time).
 * - For the missing-key test, we stub process.env and let adminClient() throw.
 */

const mutableEnv = process.env as Record<string, string | undefined>;

describe("supabase admin client", () => {
  const originalEnv = process.env;
  // Store original window (undefined in Node/Vitest)
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Ensure window is undefined by default (Node environment)
    // @ts-expect-error intentionally deleting window for tests
    delete globalThis.window;
  });

  afterEach(() => {
    process.env = originalEnv;
    // Restore window (it was undefined; no real restoration needed)
    if (originalWindow === undefined) {
      // @ts-expect-error intentionally deleting window for tests
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  });

  it("throws at module evaluation when window is defined (client-side guard)", async () => {
    // Simulate a browser environment where window is defined.
    // @ts-expect-error intentionally setting window for test
    globalThis.window = {} as Window;
    await expect(import("../../lib/supabase/admin")).rejects.toThrow(
      "lib/supabase/admin imported in client code; this client bypasses RLS",
    );
  });

  it("throws from adminClient() when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    // Ensure window is undefined so module-eval guard passes.
    // @ts-expect-error intentionally deleting window for tests
    delete globalThis.window;
    // Remove the service role key so adminClient() throws.
    delete mutableEnv.SUPABASE_SERVICE_ROLE_KEY;
    mutableEnv.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

    const { adminClient } = await import("../../lib/supabase/admin");
    expect(() => adminClient()).toThrow(
      "SUPABASE service-role config missing; admin client unavailable",
    );
  });

  it("throws from adminClient() when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    // @ts-expect-error intentionally deleting window for tests
    delete globalThis.window;
    delete mutableEnv.NEXT_PUBLIC_SUPABASE_URL;
    mutableEnv.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    const { adminClient } = await import("../../lib/supabase/admin");
    expect(() => adminClient()).toThrow(
      "SUPABASE service-role config missing; admin client unavailable",
    );
  });
});
