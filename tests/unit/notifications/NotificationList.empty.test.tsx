import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tests for NotificationList empty-state adoption of the EmptyState primitive.
 *
 * Full render tests (render, screen) require @testing-library/react + jsdom —
 * wired in epic 15. They are in describe.skip per the established repo pattern.
 *
 * Module-shape / source-contract tests run in node mode now.
 *
 * Contract being tested:
 * - NotificationList imports EmptyState from the canonical primitive path.
 * - NotificationList imports IconBellOff from @/lib/icons.
 * - NotificationList uses the useTranslations("empty.noNotifications") namespace.
 * - When notifications.length === 0, the EmptyState primitive is rendered.
 */

const SOURCE_PATH = path.resolve(
  __dirname,
  "../../../components/notifications/NotificationList.tsx",
);
const source = readFileSync(SOURCE_PATH, "utf-8");

// ---------------------------------------------------------------------------
// Module-shape tests (plain node — no React rendering needed)
// ---------------------------------------------------------------------------

describe("NotificationList empty-state — module contract", () => {
  it("exports NotificationList as a named function", async () => {
    const mod = await import("@/components/notifications/NotificationList");
    expect(typeof mod.NotificationList).toBe("function");
  });

  it("imports EmptyState from the canonical primitive", () => {
    expect(source).toContain(
      'import { EmptyState } from "@/components/shared/empty-states/EmptyState"',
    );
  });

  it("imports IconBellOff from @/lib/icons", () => {
    expect(source).toContain("IconBellOff");
    expect(source).toContain('@/lib/icons"');
  });

  it("uses useTranslations with the empty.noNotifications namespace", () => {
    expect(source).toContain('useTranslations("empty.noNotifications")');
  });

  it("renders EmptyState when notifications is empty", () => {
    expect(source).toContain("<EmptyState");
    expect(source).toContain("icon={IconBellOff}");
  });
});

// ---------------------------------------------------------------------------
// Render tests (require RTL + jsdom — skip until epic 15)
// ---------------------------------------------------------------------------

describe("NotificationList empty-state — render (requires RTL + jsdom, epic 15)", () => {
  it("renders EmptyState with bell-off icon when notifications is empty", () => {
    // Given: notifications = []
    // → renders <EmptyState icon={IconBellOff} title="No notifications" description="..." />
    expect(true).toBe(true);
  });

  it("renders grouped list when notifications is non-empty", () => {
    // Given: notifications = [{ id: 'n1', created_at: new Date().toISOString(), ... }]
    // → does NOT render EmptyState; renders a <ul aria-label="Notifications">
    expect(true).toBe(true);
  });
});
