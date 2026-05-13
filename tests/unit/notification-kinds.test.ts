/**
 * tests/unit/notification-kinds.test.ts
 *
 * Validates that lib/notifications/kinds.ts stays in sync with the
 * database constraint defined in migration 20260516000000_notifications_epic13.sql.
 *
 * Tests:
 *   1. Every kind in the SQL constraint is present in NOTIFICATION_KIND_LIST.
 *   2. No extra TypeScript-only kinds exist beyond the SQL constraint.
 *   3. Every kind in NOTIFICATION_KIND_LIST has an entry in DEFAULT_PREFS.
 *   4. DEFAULT_PREFS has no extra keys beyond NOTIFICATION_KIND_LIST.
 *   5. DISPLAY_KINDS excludes all RESERVED_KINDS.
 *   6. DISPLAY_KINDS + RESERVED_KINDS = NOTIFICATION_KIND_LIST (no gaps).
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFS,
  DISPLAY_KINDS,
  NOTIFICATION_KIND_LIST,
  RESERVED_KINDS,
} from "../../lib/notifications/kinds";

/**
 * The canonical set of kinds from the SQL constraint.
 * Keep this in sync with migration 20260516000000_notifications_epic13.sql.
 * This is intentionally duplicated here so the test catches drift in both
 * directions (kinds.ts → SQL and SQL → kinds.ts).
 */
const SQL_CONSTRAINT_KINDS = [
  "mention",
  "assigned",
  "unassigned",
  "comment_reply",
  "comment_on_followed",
  "status_changed",
  "status_changed_assigned",
  "status_changed_followed",
  "due_soon",
  "due_overdue",
  "board_invite",
  "role_changed",
  "task_created_in_followed",
] as const;

describe("NOTIFICATION_KIND_LIST", () => {
  it("contains every kind defined in the SQL constraint", () => {
    for (const kind of SQL_CONSTRAINT_KINDS) {
      expect(NOTIFICATION_KIND_LIST).toContain(kind);
    }
  });

  it("contains no extra kinds beyond what the SQL constraint defines", () => {
    const sqlSet = new Set<string>(SQL_CONSTRAINT_KINDS);
    for (const kind of NOTIFICATION_KIND_LIST) {
      expect(sqlSet.has(kind)).toBe(true);
    }
  });

  it("has exactly the same count as SQL_CONSTRAINT_KINDS", () => {
    expect(NOTIFICATION_KIND_LIST.length).toBe(SQL_CONSTRAINT_KINDS.length);
  });
});

describe("DEFAULT_PREFS", () => {
  it("has an entry for every kind in NOTIFICATION_KIND_LIST", () => {
    for (const kind of NOTIFICATION_KIND_LIST) {
      expect(DEFAULT_PREFS).toHaveProperty(kind);
    }
  });

  it("has no extra keys beyond NOTIFICATION_KIND_LIST", () => {
    const kindSet = new Set<string>(NOTIFICATION_KIND_LIST);
    for (const key of Object.keys(DEFAULT_PREFS)) {
      expect(kindSet.has(key)).toBe(true);
    }
  });

  it("each entry has valid inApp (boolean) and email (instant|digest|off)", () => {
    const validEmail = new Set(["instant", "digest", "off"]);
    for (const [kind, pref] of Object.entries(DEFAULT_PREFS)) {
      expect(typeof pref.inApp, `inApp for ${kind}`).toBe("boolean");
      expect(validEmail.has(pref.email), `email for ${kind}`).toBe(true);
    }
  });
});

describe("RESERVED_KINDS", () => {
  it("all reserved kinds exist in NOTIFICATION_KIND_LIST", () => {
    for (const kind of RESERVED_KINDS) {
      expect(NOTIFICATION_KIND_LIST).toContain(kind);
    }
  });
});

describe("DISPLAY_KINDS", () => {
  it("excludes all RESERVED_KINDS", () => {
    const reservedSet = new Set<string>(RESERVED_KINDS);
    for (const kind of DISPLAY_KINDS) {
      expect(reservedSet.has(kind)).toBe(false);
    }
  });

  it("together with RESERVED_KINDS covers all of NOTIFICATION_KIND_LIST (no gaps)", () => {
    const combined = new Set<string>([...DISPLAY_KINDS, ...RESERVED_KINDS]);
    for (const kind of NOTIFICATION_KIND_LIST) {
      expect(combined.has(kind)).toBe(true);
    }
  });

  it("combined count equals NOTIFICATION_KIND_LIST length", () => {
    expect(DISPLAY_KINDS.length + RESERVED_KINDS.length).toBe(NOTIFICATION_KIND_LIST.length);
  });
});
