/**
 * tests/unit/notification-store.test.ts
 *
 * Unit tests for the notification Zustand store.
 * Tests: idempotency, unread count, mark-read (single + all).
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { AnyNotification } from "../../stores/notification-store";
import { useNotificationStore } from "../../stores/notification-store";

// Helper to create fixture notifications
function makeNotification(overrides: Partial<AnyNotification> = {}): AnyNotification {
  return {
    id: crypto.randomUUID(),
    user_id: "user-1",
    kind: "mention",
    payload: {
      actor_id: "actor-1",
      board_id: "board-1",
      task_id: "task-1",
      comment_id: "comment-1",
    },
    read_at: null,
    created_at: new Date().toISOString(),
    email_sent_at: null,
    digested_at: null,
    ...overrides,
  } as AnyNotification;
}

// Reset store state before each test
beforeEach(() => {
  useNotificationStore.setState({
    notifications: [],
    unreadCount: 0,
    hydrated: false,
  });
});

describe("hydrate", () => {
  it("populates notifications and unreadCount", () => {
    const n1 = makeNotification();
    const n2 = makeNotification({ read_at: new Date().toISOString() });

    useNotificationStore.getState().hydrate([n1, n2], 1);

    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(2);
    expect(state.unreadCount).toBe(1);
    expect(state.hydrated).toBe(true);
  });

  it("is idempotent — second call is ignored", () => {
    const n1 = makeNotification();
    useNotificationStore.getState().hydrate([n1], 1);

    const n2 = makeNotification();
    useNotificationStore.getState().hydrate([n2], 99);

    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.unreadCount).toBe(1);
    const first = state.notifications[0];
    expect(first?.id).toBe(n1.id);
  });
});

describe("appendIfNew", () => {
  it("appends a new notification and increments unreadCount", () => {
    useNotificationStore.getState().hydrate([], 0);

    const n = makeNotification();
    useNotificationStore.getState().appendIfNew(n);

    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.unreadCount).toBe(1);
  });

  it("is idempotent — duplicate id is ignored", () => {
    useNotificationStore.getState().hydrate([], 0);

    const n = makeNotification();
    useNotificationStore.getState().appendIfNew(n);
    useNotificationStore.getState().appendIfNew(n);

    const state = useNotificationStore.getState();
    expect(state.notifications).toHaveLength(1);
    expect(state.unreadCount).toBe(1);
  });

  it("does not increment unreadCount for already-read notification", () => {
    useNotificationStore.getState().hydrate([], 0);

    const n = makeNotification({ read_at: new Date().toISOString() });
    useNotificationStore.getState().appendIfNew(n);

    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it("caps at 50 notifications", () => {
    const initial = Array.from({ length: 50 }, () => makeNotification());
    useNotificationStore.getState().hydrate(initial, 50);

    const extra = makeNotification();
    useNotificationStore.getState().appendIfNew(extra);

    expect(useNotificationStore.getState().notifications).toHaveLength(50);
  });
});

describe("markRead", () => {
  it("marks specific notifications as read and decrements unreadCount", () => {
    const n1 = makeNotification();
    const n2 = makeNotification();
    useNotificationStore.getState().hydrate([n1, n2], 2);

    useNotificationStore.getState().markRead([n1.id]);

    const state = useNotificationStore.getState();
    const updated = state.notifications.find((n) => n.id === n1.id);
    expect(updated?.read_at).not.toBeNull();
    expect(state.unreadCount).toBe(1);
  });

  it("does not double-decrement already-read notifications", () => {
    const n = makeNotification({ read_at: new Date().toISOString() });
    useNotificationStore.getState().hydrate([n], 0);

    useNotificationStore.getState().markRead([n.id]);

    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });
});

describe("markAllRead", () => {
  it("marks all notifications as read and sets unreadCount to 0", () => {
    const notifications = [makeNotification(), makeNotification(), makeNotification()];
    useNotificationStore.getState().hydrate(notifications, 3);

    useNotificationStore.getState().markAllRead();

    const state = useNotificationStore.getState();
    expect(state.unreadCount).toBe(0);
    for (const n of state.notifications) {
      expect(n.read_at).not.toBeNull();
    }
  });

  it("is safe when there are no unread notifications", () => {
    const read = makeNotification({ read_at: new Date().toISOString() });
    useNotificationStore.getState().hydrate([read], 0);

    useNotificationStore.getState().markAllRead();

    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });
});
