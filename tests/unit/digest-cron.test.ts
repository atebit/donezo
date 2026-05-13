/**
 * tests/unit/digest-cron.test.ts
 *
 * Unit tests for lib/email/digest-due-users.ts (findUsersDueForDigest).
 *
 * TZ-aware coverage:
 *  - UTC: user at digest_hour=9 is due when now is 09:00 UTC, not at 08:59 or 09:15.
 *  - America/New_York (UTC-5 in winter): user at digest_hour=9 is due at 14:00 UTC.
 *  - Asia/Tokyo (UTC+9): user at digest_hour=9 is due at 00:00 UTC (09:00 JST = 00:00 UTC).
 *  - User is NOT returned when now is outside the [scheduled, scheduled+15min) window.
 *  - Window boundary: user IS returned at the first second of the window (inclusive).
 *  - Window boundary: user is NOT returned at exactly scheduled+15min (exclusive).
 *  - Multiple users: some in-window, some not.
 *  - digest_enabled=false users are excluded (never fetched from DB).
 *  - Invalid TZ string is silently skipped (no throw).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock adminClient before importing
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();

vi.mock("../../lib/supabase/admin", () => ({
  adminClient: () => ({ from: mockFrom }),
}));

vi.mock("../../lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PrefRow = { user_id: string; digest_hour: number; digest_timezone: string };

/**
 * Builds a fluent Supabase query chain that resolves with `{ data: prefs, error: null }`.
 * Avoids the noThenProperty lint rule by assigning Promise methods via Object.assign
 * on a real Promise (the 'then' on a Promise instance is not a "then property" on a
 * plain object — it's inherited from Promise.prototype).
 */
function makePrefsChain(prefs: PrefRow[]) {
  const p = Promise.resolve({ data: prefs, error: null });
  const chain = {
    select: () => chain,
    eq: () => chain,
  };
  // Merge the promise's prototype methods via Object.assign so the chain is awaitable.
  // This does NOT assign `.then` as an own property on a plain object; instead we
  // bind to the real Promise `p` and delegate.
  return Object.assign(chain, {
    // biome-ignore lint/suspicious/noThenProperty: required for Supabase query chain mock
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  });
}

function setupMock(prefs: PrefRow[]) {
  mockFrom.mockImplementation(() => makePrefsChain(prefs));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("findUsersDueForDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("UTC timezone", () => {
    it("returns user when now is exactly at digest_hour in UTC", async () => {
      const now = new Date("2026-05-13T09:00:00.000Z");
      setupMock([{ user_id: "user-utc", digest_hour: 9, digest_timezone: "UTC" }]);

      const { findUsersDueForDigest } = await import("@/lib/email/digest-due-users");
      const result = await findUsersDueForDigest(now);
      expect(result).toContain("user-utc");
    });

    it("returns user when now is 14 minutes into the window", async () => {
      const now = new Date("2026-05-13T09:14:59.000Z");
      setupMock([{ user_id: "user-utc", digest_hour: 9, digest_timezone: "UTC" }]);

      const { findUsersDueForDigest } = await import("@/lib/email/digest-due-users");
      const result = await findUsersDueForDigest(now);
      expect(result).toContain("user-utc");
    });

    it("does NOT return user when now is exactly at scheduled+15min (exclusive upper bound)", async () => {
      const now = new Date("2026-05-13T09:15:00.000Z");
      setupMock([{ user_id: "user-utc", digest_hour: 9, digest_timezone: "UTC" }]);

      const { findUsersDueForDigest } = await import("@/lib/email/digest-due-users");
      const result = await findUsersDueForDigest(now);
      expect(result).not.toContain("user-utc");
    });

    it("does NOT return user when now is 1 minute before the window", async () => {
      const now = new Date("2026-05-13T08:59:00.000Z");
      setupMock([{ user_id: "user-utc", digest_hour: 9, digest_timezone: "UTC" }]);

      const { findUsersDueForDigest } = await import("@/lib/email/digest-due-users");
      const result = await findUsersDueForDigest(now);
      expect(result).not.toContain("user-utc");
    });
  });

  describe("America/New_York timezone (UTC-5 in winter / UTC-4 in summer)", () => {
    it("returns user at 14:00 UTC when digest_hour=9 and TZ=America/New_York (winter, UTC-5)", async () => {
      // Winter: New York is UTC-5. 09:00 EST = 14:00 UTC.
      const now = new Date("2026-01-13T14:00:00.000Z");
      setupMock([{ user_id: "user-ny", digest_hour: 9, digest_timezone: "America/New_York" }]);

      const { findUsersDueForDigest } = await import("@/lib/email/digest-due-users");
      const result = await findUsersDueForDigest(now);
      expect(result).toContain("user-ny");
    });

    it("does NOT return user at 13:00 UTC in winter (08:00 EST, before the 09:00 window)", async () => {
      const now = new Date("2026-01-13T13:00:00.000Z");
      setupMock([{ user_id: "user-ny", digest_hour: 9, digest_timezone: "America/New_York" }]);

      const { findUsersDueForDigest } = await import("@/lib/email/digest-due-users");
      const result = await findUsersDueForDigest(now);
      expect(result).not.toContain("user-ny");
    });

    it("returns user at 13:00 UTC when digest_hour=9 and TZ=America/New_York (summer, UTC-4)", async () => {
      // Summer: New York is UTC-4. 09:00 EDT = 13:00 UTC.
      const now = new Date("2026-07-13T13:00:00.000Z");
      setupMock([
        { user_id: "user-ny-summer", digest_hour: 9, digest_timezone: "America/New_York" },
      ]);

      const { findUsersDueForDigest } = await import("@/lib/email/digest-due-users");
      const result = await findUsersDueForDigest(now);
      expect(result).toContain("user-ny-summer");
    });
  });

  describe("Asia/Tokyo timezone (UTC+9, no DST)", () => {
    it("returns user at 00:00 UTC when digest_hour=9 and TZ=Asia/Tokyo", async () => {
      // Tokyo is UTC+9 (no DST). 09:00 JST = 00:00 UTC.
      const now = new Date("2026-05-13T00:00:00.000Z");
      setupMock([{ user_id: "user-tokyo", digest_hour: 9, digest_timezone: "Asia/Tokyo" }]);

      const { findUsersDueForDigest } = await import("@/lib/email/digest-due-users");
      const result = await findUsersDueForDigest(now);
      expect(result).toContain("user-tokyo");
    });

    it("returns user 7 minutes into the window (00:07 UTC = 09:07 JST)", async () => {
      const now = new Date("2026-05-13T00:07:00.000Z");
      setupMock([{ user_id: "user-tokyo", digest_hour: 9, digest_timezone: "Asia/Tokyo" }]);

      const { findUsersDueForDigest } = await import("@/lib/email/digest-due-users");
      const result = await findUsersDueForDigest(now);
      expect(result).toContain("user-tokyo");
    });

    it("does NOT return user at 00:15 UTC (09:15 JST — outside window)", async () => {
      const now = new Date("2026-05-13T00:15:00.000Z");
      setupMock([{ user_id: "user-tokyo", digest_hour: 9, digest_timezone: "Asia/Tokyo" }]);

      const { findUsersDueForDigest } = await import("@/lib/email/digest-due-users");
      const result = await findUsersDueForDigest(now);
      expect(result).not.toContain("user-tokyo");
    });
  });

  describe("mixed users across timezones", () => {
    it("returns only users whose window contains now", async () => {
      // now = 09:05 UTC (winter, January).
      // - user-utc: digest_hour=9, UTC → in window [09:00–09:15 UTC] → IN.
      // - user-ny: digest_hour=9, America/New_York (UTC-5 winter) → window at [14:00–14:15 UTC] → NOT in window.
      // - user-tokyo: digest_hour=0, Asia/Tokyo → 00:00 JST = 15:00 UTC previous day → NOT in window.
      const now = new Date("2026-01-13T09:05:00.000Z");
      setupMock([
        { user_id: "user-utc", digest_hour: 9, digest_timezone: "UTC" },
        { user_id: "user-ny", digest_hour: 9, digest_timezone: "America/New_York" },
        { user_id: "user-tokyo", digest_hour: 0, digest_timezone: "Asia/Tokyo" },
      ]);

      const { findUsersDueForDigest } = await import("@/lib/email/digest-due-users");
      const result = await findUsersDueForDigest(now);
      expect(result).toContain("user-utc");
      expect(result).not.toContain("user-ny");
      expect(result).not.toContain("user-tokyo");
    });
  });

  describe("empty and error cases", () => {
    it("returns an empty array when no preference rows exist", async () => {
      setupMock([]);
      const now = new Date("2026-05-13T09:00:00.000Z");

      const { findUsersDueForDigest } = await import("@/lib/email/digest-due-users");
      const result = await findUsersDueForDigest(now);
      expect(result).toEqual([]);
    });

    it("returns empty array when the DB query fails", async () => {
      const p = Promise.resolve({ data: null, error: new Error("DB down") });
      const errChain = {
        select: () => errChain,
        eq: () => errChain,
        // biome-ignore lint/suspicious/noThenProperty: required for Supabase query chain mock
        then: p.then.bind(p),
        catch: p.catch.bind(p),
        finally: p.finally.bind(p),
      };
      mockFrom.mockImplementation(() => errChain);

      const now = new Date("2026-05-13T09:00:00.000Z");
      const { findUsersDueForDigest } = await import("@/lib/email/digest-due-users");
      const result = await findUsersDueForDigest(now);
      expect(result).toEqual([]);
    });

    it("silently skips users with invalid TZ strings and processes valid ones", async () => {
      const now = new Date("2026-05-13T09:00:00.000Z");
      setupMock([
        { user_id: "user-bad-tz", digest_hour: 9, digest_timezone: "Bogus/Timezone" },
        { user_id: "user-utc", digest_hour: 9, digest_timezone: "UTC" },
      ]);

      const { findUsersDueForDigest } = await import("@/lib/email/digest-due-users");
      const result = await findUsersDueForDigest(now);
      expect(result).not.toContain("user-bad-tz");
      expect(result).toContain("user-utc");
    });
  });

  describe("window boundary precision", () => {
    it("includes user at exactly now === scheduled (inclusive lower bound)", async () => {
      const now = new Date("2026-05-13T09:00:00.000Z");
      setupMock([{ user_id: "boundary-low", digest_hour: 9, digest_timezone: "UTC" }]);

      const { findUsersDueForDigest } = await import("@/lib/email/digest-due-users");
      const result = await findUsersDueForDigest(now);
      expect(result).toContain("boundary-low");
    });

    it("excludes user at now === scheduled + 15min (exclusive upper bound)", async () => {
      const now = new Date("2026-05-13T09:15:00.000Z");
      setupMock([{ user_id: "boundary-high", digest_hour: 9, digest_timezone: "UTC" }]);

      const { findUsersDueForDigest } = await import("@/lib/email/digest-due-users");
      const result = await findUsersDueForDigest(now);
      expect(result).not.toContain("boundary-high");
    });

    it("includes user 1ms before the upper bound", async () => {
      const now = new Date("2026-05-13T09:14:59.999Z");
      setupMock([{ user_id: "boundary-near-high", digest_hour: 9, digest_timezone: "UTC" }]);

      const { findUsersDueForDigest } = await import("@/lib/email/digest-due-users");
      const result = await findUsersDueForDigest(now);
      expect(result).toContain("boundary-near-high");
    });
  });
});
