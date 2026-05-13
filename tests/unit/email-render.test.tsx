/**
 * tests/unit/email-render.test.tsx
 *
 * Snapshot tests for React Email templates.
 * Renders each template to HTML via @react-email/render and asserts that:
 *   - Rendering does not throw.
 *   - The output includes expected strings (subject lines, CTAs, names).
 *
 * These are not visual regressions — they confirm the templates render without
 * runtime errors and contain the expected data.
 */

import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { AssignedEmail } from "@/emails/assigned/Assigned";
import { CommentOnFollowedEmail } from "@/emails/comment-on-followed/CommentOnFollowed";
import { CommentReplyEmail } from "@/emails/comment-reply/CommentReply";
import { DigestEmail } from "@/emails/digest/Digest";
import { DueSoonEmail } from "@/emails/due-soon/DueSoon";
import { InviteEmail } from "@/emails/invite/Invite";
import { MentionEmail } from "@/emails/mention/Mention";
import { RoleChangedEmail } from "@/emails/role-changed/RoleChanged";
import { StatusChangedEmail } from "@/emails/status-changed/StatusChanged";
import type { DigestData } from "@/lib/email/digest-types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_TASK = "Fix the login bug";
const FIXTURE_BOARD = "Engineering";
const FIXTURE_WS = "Acme Corp";
const FIXTURE_ACTOR = "Alice";
const FIXTURE_CTA = "https://app.donezo.app/task/123";
const FIXTURE_COMMENT = "This is a test comment preview";

// ---------------------------------------------------------------------------
// MentionEmail
// ---------------------------------------------------------------------------

describe("MentionEmail", () => {
  it("renders without error and contains key strings", async () => {
    const html = await render(
      MentionEmail({
        actorName: FIXTURE_ACTOR,
        taskTitle: FIXTURE_TASK,
        boardTitle: FIXTURE_BOARD,
        workspaceName: FIXTURE_WS,
        commentPreview: FIXTURE_COMMENT,
        ctaHref: FIXTURE_CTA,
      }),
    );
    expect(html).toContain(FIXTURE_ACTOR);
    expect(html).toContain(FIXTURE_TASK);
    expect(html).toContain(FIXTURE_COMMENT);
    expect(html).toContain(FIXTURE_CTA);
    expect(html).toContain("<!DOCTYPE html");
  });
});

// ---------------------------------------------------------------------------
// AssignedEmail
// ---------------------------------------------------------------------------

describe("AssignedEmail", () => {
  it("renders without error and contains key strings", async () => {
    const html = await render(
      AssignedEmail({
        actorName: FIXTURE_ACTOR,
        taskTitle: FIXTURE_TASK,
        boardTitle: FIXTURE_BOARD,
        workspaceName: FIXTURE_WS,
        ctaHref: FIXTURE_CTA,
      }),
    );
    expect(html).toContain(FIXTURE_ACTOR);
    expect(html).toContain(FIXTURE_TASK);
    expect(html).toContain(FIXTURE_CTA);
  });
});

// ---------------------------------------------------------------------------
// CommentReplyEmail
// ---------------------------------------------------------------------------

describe("CommentReplyEmail", () => {
  it("renders without error and contains key strings", async () => {
    const html = await render(
      CommentReplyEmail({
        actorName: FIXTURE_ACTOR,
        taskTitle: FIXTURE_TASK,
        boardTitle: FIXTURE_BOARD,
        workspaceName: FIXTURE_WS,
        commentPreview: FIXTURE_COMMENT,
        ctaHref: FIXTURE_CTA,
      }),
    );
    expect(html).toContain(FIXTURE_ACTOR);
    expect(html).toContain(FIXTURE_TASK);
    expect(html).toContain(FIXTURE_COMMENT);
  });
});

// ---------------------------------------------------------------------------
// CommentOnFollowedEmail
// ---------------------------------------------------------------------------

describe("CommentOnFollowedEmail", () => {
  it("renders without error and contains key strings", async () => {
    const html = await render(
      CommentOnFollowedEmail({
        actorName: FIXTURE_ACTOR,
        taskTitle: FIXTURE_TASK,
        boardTitle: FIXTURE_BOARD,
        workspaceName: FIXTURE_WS,
        commentPreview: FIXTURE_COMMENT,
        ctaHref: FIXTURE_CTA,
      }),
    );
    expect(html).toContain(FIXTURE_ACTOR);
    expect(html).toContain(FIXTURE_TASK);
  });
});

// ---------------------------------------------------------------------------
// StatusChangedEmail
// ---------------------------------------------------------------------------

describe("StatusChangedEmail", () => {
  it("renders 'assigned' variant without error", async () => {
    const html = await render(
      StatusChangedEmail({
        actorName: FIXTURE_ACTOR,
        taskTitle: FIXTURE_TASK,
        boardTitle: FIXTURE_BOARD,
        workspaceName: FIXTURE_WS,
        fromLabel: "In Progress",
        toLabel: "Done",
        relationship: "assigned",
        ctaHref: FIXTURE_CTA,
      }),
    );
    expect(html).toContain(FIXTURE_TASK);
    expect(html).toContain("In Progress");
    expect(html).toContain("Done");
  });

  it("renders 'followed' variant without error", async () => {
    const html = await render(
      StatusChangedEmail({
        actorName: FIXTURE_ACTOR,
        taskTitle: FIXTURE_TASK,
        boardTitle: FIXTURE_BOARD,
        workspaceName: FIXTURE_WS,
        fromLabel: null,
        toLabel: "Blocked",
        relationship: "followed",
        ctaHref: FIXTURE_CTA,
      }),
    );
    expect(html).toContain("Blocked");
  });
});

// ---------------------------------------------------------------------------
// DueSoonEmail
// ---------------------------------------------------------------------------

describe("DueSoonEmail", () => {
  it("renders 'due_soon' variant", async () => {
    const html = await render(
      DueSoonEmail({
        taskTitle: FIXTURE_TASK,
        boardTitle: FIXTURE_BOARD,
        workspaceName: FIXTURE_WS,
        dueDate: "2026-05-15",
        variant: "due_soon",
        ctaHref: FIXTURE_CTA,
      }),
    );
    expect(html).toContain(FIXTURE_TASK);
    expect(html).toContain("due soon");
  });

  it("renders 'due_overdue' variant", async () => {
    const html = await render(
      DueSoonEmail({
        taskTitle: FIXTURE_TASK,
        boardTitle: FIXTURE_BOARD,
        workspaceName: FIXTURE_WS,
        dueDate: "2026-05-10",
        variant: "due_overdue",
        ctaHref: FIXTURE_CTA,
      }),
    );
    expect(html).toContain("overdue");
  });
});

// ---------------------------------------------------------------------------
// InviteEmail
// ---------------------------------------------------------------------------

describe("InviteEmail", () => {
  it("renders workspace-only invite (new user)", async () => {
    const html = await render(
      InviteEmail({
        inviterName: FIXTURE_ACTOR,
        workspaceName: FIXTURE_WS,
        acceptHref: "https://app.donezo.app/join/abc123",
        isExistingUser: false,
      }),
    );
    expect(html).toContain(FIXTURE_ACTOR);
    expect(html).toContain(FIXTURE_WS);
    expect(html).toContain("abc123");
    expect(html).toContain("create your free account");
  });

  it("renders board invite (existing user)", async () => {
    const html = await render(
      InviteEmail({
        inviterName: FIXTURE_ACTOR,
        workspaceName: FIXTURE_WS,
        boardName: FIXTURE_BOARD,
        acceptHref: "https://app.donezo.app/join/def456",
        isExistingUser: true,
      }),
    );
    expect(html).toContain(FIXTURE_BOARD);
    expect(html).toContain("def456");
    expect(html).toContain("Accept invitation");
  });
});

// ---------------------------------------------------------------------------
// RoleChangedEmail
// ---------------------------------------------------------------------------

describe("RoleChangedEmail", () => {
  it("renders workspace role change", async () => {
    const html = await render(
      RoleChangedEmail({
        actorName: FIXTURE_ACTOR,
        contextName: FIXTURE_WS,
        contextKind: "workspace",
        fromRole: "member",
        toRole: "admin",
        ctaHref: FIXTURE_CTA,
      }),
    );
    expect(html).toContain("admin");
    expect(html).toContain(FIXTURE_WS);
  });

  it("renders board role change without fromRole", async () => {
    const html = await render(
      RoleChangedEmail({
        actorName: FIXTURE_ACTOR,
        contextName: FIXTURE_BOARD,
        contextKind: "board",
        fromRole: null,
        toRole: "viewer",
        ctaHref: FIXTURE_CTA,
      }),
    );
    expect(html).toContain("viewer");
  });
});

// ---------------------------------------------------------------------------
// DigestEmail
// ---------------------------------------------------------------------------

describe("DigestEmail", () => {
  it("renders with sections and counts", async () => {
    const data: DigestData = {
      recipient: { displayName: "Bob", email: "bob@example.com" },
      counts: {
        mentions: 2,
        statusChanges: 1,
        assigned: 1,
        commentsOnFollowed: 0,
        total: 4,
      },
      sections: [
        {
          board: { id: "board-1", title: "Engineering", workspaceSlug: "acme" },
          items: [
            {
              id: "n-1",
              kind: "mention",
              actor: { name: "Alice" },
              task: { id: "t-1", title: "Fix the login bug" },
              createdAt: "2026-05-12T10:00:00Z",
              href: "https://app.donezo.app/task/t-1",
            },
          ],
          moreCount: 3,
        },
      ],
      generatedAt: "2026-05-12T10:30:00Z",
    };

    const html = await render(DigestEmail({ data }));
    expect(html).toContain("Bob");
    expect(html).toContain("Engineering");
    expect(html).toContain("Fix the login bug");
    expect(html).toContain("Alice");
    expect(html).toContain("3"); // moreCount appears in "+3 more notifications"
    expect(html).toContain("more notification");
  });
});
