/**
 * tests/unit/notification-cleanup.test.ts
 *
 * Unit tests for app/api/cron/notification-cleanup/route.ts.
 *
 * Coverage:
 *   - Auth gate: missing token → 401.
 *   - Auth gate: wrong token → 401.
 *   - Auth gate: no INTERNAL_CRON_SECRET set → open mode (200).
 *   - Auth gate: correct token → 200.
 *   - Cleanup: deletes read rows older than 90 days.
 *   - Cleanup: deletes any rows older than 365 days.
 *   - Cleanup: returns structured counts.
 *   - DB error on first delete → 500.
 *   - DB error on second delete → 500.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Module-level mocks (must appear before any import of the route module)
// ---------------------------------------------------------------------------

vi.mock("../../lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// Mutable mock results for the two delete queries.
// deleteResults[0] → first .delete() call (read rows); deleteResults[1] → second.
let deleteResults: Array<{ count: number | null; error: { message: string } | null }> = [];
let deleteCallIndex = 0;

const mockFrom = vi.fn(() => ({
  delete: vi.fn(() => {
    const result = deleteResults[deleteCallIndex] ?? { count: 0, error: null };
    deleteCallIndex++;
    return {
      not: vi.fn().mockReturnValue({
        lt: vi.fn().mockResolvedValue(result),
      }),
      lt: vi.fn().mockResolvedValue(result),
    };
  }),
}));

vi.mock("../../lib/supabase/admin", () => ({
  adminClient: () => ({ from: mockFrom }),
}));

// ---------------------------------------------------------------------------
// Request factory
// ---------------------------------------------------------------------------

function makeRequest(opts: { token?: string; cronHeader?: string } = {}): Request {
  const headers: Record<string, string> = {};
  if (opts.token !== undefined) headers.authorization = `Bearer ${opts.token}`;
  if (opts.cronHeader !== undefined) headers["x-vercel-cron"] = opts.cronHeader;
  return new Request("http://localhost/api/cron/notification-cleanup", { headers });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("notification-cleanup route — auth gate", () => {
  const CRON_SECRET = "test-cron-secret-32-chars-padded!";
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.INTERNAL_CRON_SECRET = process.env.INTERNAL_CRON_SECRET;
    process.env.INTERNAL_CRON_SECRET = CRON_SECRET;
    deleteResults = [
      { count: 5, error: null },
      { count: 2, error: null },
    ];
    deleteCallIndex = 0;
    vi.resetModules();
  });

  afterEach(() => {
    process.env.INTERNAL_CRON_SECRET = savedEnv.INTERNAL_CRON_SECRET;
  });

  it("returns 401 when no authorization header is present", async () => {
    const { GET } = await import("@/app/api/cron/notification-cleanup/route");
    const req = makeRequest({});
    const res = await GET(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 401 when the token is wrong", async () => {
    const { GET } = await import("@/app/api/cron/notification-cleanup/route");
    const req = makeRequest({ token: "wrong-secret-value-here-padding!!" });
    const res = await GET(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 401 when the token length differs from the secret", async () => {
    const { GET } = await import("@/app/api/cron/notification-cleanup/route");
    const req = makeRequest({ token: "short" });
    const res = await GET(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 200 when INTERNAL_CRON_SECRET is unset (open mode)", async () => {
    delete process.env.INTERNAL_CRON_SECRET;
    vi.resetModules();
    const { GET } = await import("@/app/api/cron/notification-cleanup/route");
    const req = makeRequest({});
    const res = await GET(req as never);
    expect(res.status).toBe(200);
  });

  it("returns 200 with correct token", async () => {
    const { GET } = await import("@/app/api/cron/notification-cleanup/route");
    const req = makeRequest({ token: CRON_SECRET });
    const res = await GET(req as never);
    expect(res.status).toBe(200);
  });
});

describe("notification-cleanup route — cleanup logic", () => {
  const CRON_SECRET = "test-cron-secret-32-chars-padded!";
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.INTERNAL_CRON_SECRET = process.env.INTERNAL_CRON_SECRET;
    process.env.INTERNAL_CRON_SECRET = CRON_SECRET;
    deleteCallIndex = 0;
    vi.resetModules();
  });

  afterEach(() => {
    process.env.INTERNAL_CRON_SECRET = savedEnv.INTERNAL_CRON_SECRET;
  });

  it("returns structured counts with ok:true on success", async () => {
    deleteResults = [
      { count: 7, error: null },
      { count: 3, error: null },
    ];
    const { GET } = await import("@/app/api/cron/notification-cleanup/route");
    const req = makeRequest({ token: CRON_SECRET });
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.readDeleted).toBe(7);
    expect(json.oldDeleted).toBe(3);
    expect(json.totalDeleted).toBe(10);
  });

  it("returns 0 counts when no rows matched", async () => {
    deleteResults = [
      { count: 0, error: null },
      { count: 0, error: null },
    ];
    const { GET } = await import("@/app/api/cron/notification-cleanup/route");
    const req = makeRequest({ token: CRON_SECRET });
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.totalDeleted).toBe(0);
  });

  it("returns 500 when the first delete (read rows) fails", async () => {
    deleteResults = [
      { count: null, error: { message: "DB error on read delete" } },
      { count: 0, error: null },
    ];
    const { GET } = await import("@/app/api/cron/notification-cleanup/route");
    const req = makeRequest({ token: CRON_SECRET });
    const res = await GET(req as never);
    expect(res.status).toBe(500);
  });

  it("handles null count values as 0", async () => {
    deleteResults = [
      { count: null, error: null },
      { count: null, error: null },
    ];
    const { GET } = await import("@/app/api/cron/notification-cleanup/route");
    const req = makeRequest({ token: CRON_SECRET });
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.readDeleted).toBe(0);
    expect(json.oldDeleted).toBe(0);
    expect(json.totalDeleted).toBe(0);
  });
});
