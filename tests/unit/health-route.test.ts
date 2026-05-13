/**
 * tests/unit/health-route.test.ts
 *
 * Unit tests for app/api/health/route.ts.
 *
 * Coverage:
 *   - Success path: Supabase query succeeds → 200 { ok: true, sha, ts }.
 *   - DB error path: Supabase returns { error } → 503 { ok: false, error }.
 *   - createClient throws: constructor throws → 503 { ok: false, error }.
 *
 * Mocks:
 *   - @/lib/supabase/server: createClient, configured per test.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Module-level mock — must appear before any import of the route module.
// ---------------------------------------------------------------------------

// We use a configurable factory so each test can control the query result.
let mockQueryResult: { error: { message: string } | null } = { error: null };
let mockCreateClientImpl: () => Promise<unknown> = async () => ({
  from: () => ({
    select: () => ({
      limit: () => Promise.resolve(mockQueryResult),
    }),
  }),
});

vi.mock("@/lib/supabase/server", () => ({
  get createClient() {
    return mockCreateClientImpl;
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/health", () => {
  beforeEach(() => {
    // Reset to a successful query result before each test.
    mockQueryResult = { error: null };
    mockCreateClientImpl = async () => ({
      from: () => ({
        select: () => ({
          limit: () => Promise.resolve(mockQueryResult),
        }),
      }),
    });
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 with ok:true when Supabase query succeeds", async () => {
    mockQueryResult = { error: null };
    const { GET } = await import("@/app/api/health/route");

    const res = await GET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.sha).toBeDefined();
    expect(typeof json.ts).toBe("number");
  });

  it("returns 503 with ok:false when Supabase query returns an error", async () => {
    mockQueryResult = { error: { message: "connection refused" } };
    const { GET } = await import("@/app/api/health/route");

    const res = await GET();

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("connection refused");
  });

  it("returns 503 with ok:false when createClient throws", async () => {
    mockCreateClientImpl = async () => {
      throw new Error("Supabase public env keys missing");
    };
    const { GET } = await import("@/app/api/health/route");

    const res = await GET();

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe("Supabase public env keys missing");
  });

  it("includes sha from NEXT_PUBLIC_BUILD_SHA when VERCEL_GIT_COMMIT_SHA is not set", async () => {
    const savedVercel = process.env.VERCEL_GIT_COMMIT_SHA;
    const savedBuild = process.env.NEXT_PUBLIC_BUILD_SHA;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    process.env.NEXT_PUBLIC_BUILD_SHA = "abc123";
    vi.resetModules();

    try {
      const { GET } = await import("@/app/api/health/route");
      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.sha).toBe("abc123");
    } finally {
      process.env.VERCEL_GIT_COMMIT_SHA = savedVercel;
      process.env.NEXT_PUBLIC_BUILD_SHA = savedBuild;
    }
  });

  it("falls back sha to 'unknown' when neither SHA env var is set", async () => {
    const savedVercel = process.env.VERCEL_GIT_COMMIT_SHA;
    const savedBuild = process.env.NEXT_PUBLIC_BUILD_SHA;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.NEXT_PUBLIC_BUILD_SHA;
    vi.resetModules();

    try {
      const { GET } = await import("@/app/api/health/route");
      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.sha).toBe("unknown");
    } finally {
      process.env.VERCEL_GIT_COMMIT_SHA = savedVercel;
      process.env.NEXT_PUBLIC_BUILD_SHA = savedBuild;
    }
  });
});
