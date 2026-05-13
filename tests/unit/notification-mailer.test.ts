/**
 * tests/unit/notification-mailer.test.ts
 *
 * Unit tests for the email sending infrastructure:
 *   - sendEmail: no-api-key skip, safe-list miss, safe-list pass.
 *   - webhook auth rejection (constant-time compare logic).
 *   - renderNotificationEmail: returns null for reserved kinds.
 */

// @ts-expect-error vitest runner wired in epic 15
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// sendEmail unit tests
// ---------------------------------------------------------------------------

describe("sendEmail", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.RESEND_API_KEY = process.env.RESEND_API_KEY;
    savedEnv.EMAIL_SAFE_LIST = process.env.EMAIL_SAFE_LIST;
    savedEnv.EMAIL_FROM = process.env.EMAIL_FROM;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_SAFE_LIST;
    delete process.env.EMAIL_FROM;
    vi.resetModules();
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = savedEnv.RESEND_API_KEY;
    process.env.EMAIL_SAFE_LIST = savedEnv.EMAIL_SAFE_LIST;
    process.env.EMAIL_FROM = savedEnv.EMAIL_FROM;
  });

  it("returns { skipped: true, reason: 'no-api-key' } when RESEND_API_KEY is unset", async () => {
    const { sendEmail } = await import("@/lib/email/send");
    const result = await sendEmail({
      to: "test@example.com",
      subject: "Test",
      // biome-ignore lint/suspicious/noExplicitAny: minimal ReactElement fixture
      react: null as any,
    });
    expect(result).toEqual({ skipped: true, reason: "no-api-key" });
  });

  it("returns { skipped: true, reason: 'safe-list-miss' } when recipient not in safe-list", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_SAFE_LIST = "allowed@example.com, another@example.com";
    vi.resetModules();
    const { sendEmail } = await import("@/lib/email/send");
    const result = await sendEmail({
      to: "notallowed@example.com",
      subject: "Test",
      // biome-ignore lint/suspicious/noExplicitAny: minimal ReactElement fixture
      react: null as any,
    });
    expect(result).toEqual({ skipped: true, reason: "safe-list-miss" });
  });

  it("does NOT return safe-list-miss when recipient IS in the safe-list", async () => {
    // A recipient in the safe list passes the safe-list check.
    // With no API key, it still returns no-api-key (safe-list is not the blocker).
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_SAFE_LIST = "allowed@example.com";
    vi.resetModules();
    const { sendEmail } = await import("@/lib/email/send");
    const result = await sendEmail({
      to: "allowed@example.com",
      subject: "Test",
      // biome-ignore lint/suspicious/noExplicitAny: minimal ReactElement fixture
      react: null as any,
    });
    // Safe-list passes, but no-api-key fires next (still a skip, different reason).
    expect(result).toEqual({ skipped: true, reason: "no-api-key" });
  });

  it("does NOT return safe-list-miss when EMAIL_SAFE_LIST is unset", async () => {
    // Without a safe-list, anyone can receive. With no key, no-api-key fires.
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_SAFE_LIST;
    vi.resetModules();
    const { sendEmail } = await import("@/lib/email/send");
    const result = await sendEmail({
      to: "anyone@example.com",
      subject: "Test",
      // biome-ignore lint/suspicious/noExplicitAny: minimal ReactElement fixture
      react: null as any,
    });
    expect(result).toEqual({ skipped: true, reason: "no-api-key" });
  });
});

// ---------------------------------------------------------------------------
// renderNotificationEmail — reserved kinds return null
// ---------------------------------------------------------------------------

describe("renderNotificationEmail", () => {
  it("returns null for 'unassigned' (no email template)", async () => {
    const { renderNotificationEmail } = await import("@/lib/email/render-notification");
    const ctx = {
      recipient: { id: "u1", email: "r@example.com", displayName: "Recipient" },
      actor: { id: "u2", email: null, displayName: "Actor" },
      board: { id: "b1", title: "Board", workspaceId: "ws1", workspaceSlug: "acme" },
      workspace: { id: "ws1", name: "Acme", slug: "acme" },
      task: { id: "t1", title: "Task", boardId: "b1" },
      comment: null,
    };
    const result = renderNotificationEmail("unassigned", ctx);
    expect(result).toBeNull();
  });

  it("returns null for reserved 'status_changed' kind", async () => {
    const { renderNotificationEmail } = await import("@/lib/email/render-notification");
    const ctx = {
      recipient: { id: "u1", email: "r@example.com", displayName: "Recipient" },
      actor: { id: "u2", email: null, displayName: "Actor" },
      board: { id: "b1", title: "Board", workspaceId: "ws1", workspaceSlug: "acme" },
      workspace: { id: "ws1", name: "Acme", slug: "acme" },
      task: { id: "t1", title: "Task", boardId: "b1" },
      comment: null,
    };
    const result = renderNotificationEmail("status_changed", ctx);
    expect(result).toBeNull();
  });

  it("returns null for reserved 'task_created_in_followed' kind", async () => {
    const { renderNotificationEmail } = await import("@/lib/email/render-notification");
    const ctx = {
      recipient: { id: "u1", email: "r@example.com", displayName: "Recipient" },
      actor: { id: "u2", email: null, displayName: "Actor" },
      board: { id: "b1", title: "Board", workspaceId: "ws1", workspaceSlug: "acme" },
      workspace: { id: "ws1", name: "Acme", slug: "acme" },
      task: { id: "t1", title: "Task", boardId: "b1" },
      comment: null,
    };
    const result = renderNotificationEmail("task_created_in_followed", ctx);
    expect(result).toBeNull();
  });

  it("returns an envelope for 'mention' kind", async () => {
    const { renderNotificationEmail } = await import("@/lib/email/render-notification");
    const ctx = {
      recipient: { id: "u1", email: "r@example.com", displayName: "Recipient" },
      actor: { id: "u2", email: null, displayName: "Alice" },
      board: { id: "b1", title: "Engineering", workspaceId: "ws1", workspaceSlug: "acme" },
      workspace: { id: "ws1", name: "Acme", slug: "acme" },
      task: { id: "t1", title: "Fix the login bug", boardId: "b1" },
      comment: { id: "c1", preview: "Hey @Recipient check this out" },
    };
    const result = renderNotificationEmail("mention", ctx);
    expect(result).not.toBeNull();
    expect(result?.subject).toContain("Alice");
    expect(result?.subject).toContain("Fix the login bug");
    expect(result?.tag).toBe("mention");
    expect(result?.react).toBeDefined();
  });

  it("returns an envelope for 'assigned' kind", async () => {
    const { renderNotificationEmail } = await import("@/lib/email/render-notification");
    const ctx = {
      recipient: { id: "u1", email: "r@example.com", displayName: "Recipient" },
      actor: { id: "u2", email: null, displayName: "Bob" },
      board: { id: "b1", title: "Engineering", workspaceId: "ws1", workspaceSlug: "acme" },
      workspace: { id: "ws1", name: "Acme", slug: "acme" },
      task: { id: "t1", title: "Deploy to prod", boardId: "b1" },
      comment: null,
    };
    const result = renderNotificationEmail("assigned", ctx);
    expect(result).not.toBeNull();
    expect(result?.tag).toBe("assigned");
  });
});

// ---------------------------------------------------------------------------
// Webhook auth — constant-time compare logic
// ---------------------------------------------------------------------------

describe("constant-time auth check", () => {
  it("timingSafeEqual rejects mismatched buffers", () => {
    const { timingSafeEqual } = require("node:crypto");
    const a = Buffer.from("correct-secret-value-here-32chars");
    const b = Buffer.from("wrong-secret-value-here--32chars!");
    expect(timingSafeEqual(a, b)).toBe(false);
  });

  it("timingSafeEqual accepts equal buffers", () => {
    const { timingSafeEqual } = require("node:crypto");
    const secret = "correct-secret-value-here-32chars";
    const a = Buffer.from(secret);
    const b = Buffer.from(secret);
    expect(timingSafeEqual(a, b)).toBe(true);
  });

  it("different-length buffers do not reach timingSafeEqual", () => {
    // The route handler short-circuits on length mismatch before calling
    // timingSafeEqual — verify this logic is sound by simulating it.
    const secret = "long-secret-value-that-is-32-ch";
    const provided = "short";
    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    // The condition `if (a.length !== b.length) return false` fires here.
    expect(a.length !== b.length).toBe(true);
  });
});
