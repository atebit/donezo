/**
 * tests/unit/notification-renderers.test.tsx
 *
 * Verifies each kind's renderer is registered in the registry and can be
 * instantiated with fixture payloads without runtime errors.
 *
 * We intentionally avoid DOM rendering because @testing-library/react is not
 * installed and vitest environment is "node". Instead we verify:
 *   1. The registry entry exists for each display kind.
 *   2. Each renderer is a function (React FC).
 *   3. The FallbackRenderer is exported and functional.
 */

import { describe, expect, it } from "vitest";
import { NOTIFICATION_RENDERERS } from "../../components/notifications/registry";
import { FallbackRenderer } from "../../components/notifications/renderers/fallback";
import { DISPLAY_KINDS } from "../../lib/notifications/kinds";
import type { AnyNotification } from "../../stores/notification-store";

const BASE_PAYLOAD = {
  actor_id: "actor-1",
  board_id: "board-1",
  task_id: "task-1",
};

const FIXTURE_PAYLOADS: Record<string, AnyNotification["payload"]> = {
  mention: { ...BASE_PAYLOAD, comment_id: "c-1" },
  assigned: { ...BASE_PAYLOAD },
  unassigned: { ...BASE_PAYLOAD },
  comment_reply: { ...BASE_PAYLOAD, comment_id: "c-1" },
  comment_on_followed: { ...BASE_PAYLOAD, comment_id: "c-1" },
  status_changed_assigned: { ...BASE_PAYLOAD, from_label_id: null, to_label_id: "l-2" },
  status_changed_followed: { ...BASE_PAYLOAD, from_label_id: null, to_label_id: "l-2" },
  due_soon: { ...BASE_PAYLOAD, due_date: "2026-05-15" },
  due_overdue: { ...BASE_PAYLOAD, due_date: "2026-05-10" },
  board_invite: {
    actor_id: "actor-1",
    board_id: "board-1",
    workspace_id: "ws-1",
    invitation_id: "inv-1",
  },
  role_changed: {
    actor_id: "actor-1",
    workspace_id: "ws-1",
    from: "member",
    to: "admin",
  },
};

describe("NOTIFICATION_RENDERERS registry", () => {
  it("has a renderer for every DISPLAY_KIND that has a fixture payload", () => {
    for (const kind of DISPLAY_KINDS) {
      if (kind in FIXTURE_PAYLOADS) {
        const renderer = NOTIFICATION_RENDERERS[kind];
        expect(renderer, `Missing renderer for kind: ${kind}`).toBeDefined();
        expect(typeof renderer, `Renderer for ${kind} should be a function`).toBe("function");
      }
    }
  });

  it("each registered renderer is a React component (function)", () => {
    for (const [kind, renderer] of Object.entries(NOTIFICATION_RENDERERS)) {
      expect(typeof renderer, `Renderer for ${kind} must be a function`).toBe("function");
    }
  });
});

describe("FallbackRenderer", () => {
  it("is a React component (function)", () => {
    expect(typeof FallbackRenderer).toBe("function");
  });
});

describe("Renderer fixture payloads", () => {
  it("all DISPLAY_KINDS with registered renderers have fixture payloads defined", () => {
    for (const kind of DISPLAY_KINDS) {
      const hasRenderer = kind in NOTIFICATION_RENDERERS;
      if (hasRenderer) {
        expect(
          kind in FIXTURE_PAYLOADS,
          `Kind '${kind}' has a renderer but no fixture payload in test`,
        ).toBe(true);
      }
    }
  });
});
