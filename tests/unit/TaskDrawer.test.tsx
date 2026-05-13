import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/**
 * Tests for <TaskDrawer /> — the task detail drawer component.
 *
 * Runner wired in epic 15. Tests are stubbed with describe.skip per established
 * repo pattern (40+ existing test files follow this).
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/hooks/use-task-drawer-presence", () => ({
  useTaskDrawerPresence: vi.fn(),
}));

vi.mock("@/hooks/use-board", () => ({
  useBoard: vi.fn(() => ({
    board: {
      id: "board-1",
      name: "Test Board",
      workspace_id: "ws-1",
      is_private: false,
      description: "",
      created_by: null,
      deleted_at: null,
    },
    role: "member",
    isStarred: false,
    userId: "user-1",
  })),
}));

vi.mock("@/stores/board-store", () => ({
  useBoardStore: vi.fn((selector: (s: unknown) => unknown) => {
    const mockState = {
      hydrateCommentsForTask: vi.fn(),
      hydrateReactionsForComments: vi.fn(),
      hydrateActivityForTask: vi.fn(),
      columns: [],
      labelsByColumn: new Map(),
    };
    return typeof selector === "function" ? selector(mockState) : mockState;
  }),
  selectTaskActivity: vi.fn(() => []),
}));

vi.mock("@/components/board/tabs/UpdatesTab", () => ({
  UpdatesTab: () => <div data-testid="updates-tab">Updates</div>,
}));
vi.mock("@/components/board/tabs/ActivityTab", () => ({
  ActivityTab: () => <div data-testid="activity-tab">Activity</div>,
}));
vi.mock("@/components/board/tabs/FilesTab", () => ({
  FilesTab: () => <div data-testid="files-tab">Files placeholder</div>,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeTask = (overrides = {}) => ({
  id: "task-1",
  board_id: "board-1",
  group_id: "group-1",
  title: "My Task",
  position: 1,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  deleted_at: null,
  created_by: "user-1",
  ...overrides,
});

const baseProps = {
  taskId: "task-1",
  task: makeTask(),
  comments: [],
  reactions: [],
  activity: [],
  mentionableMembers: [],
  currentUserId: "user-1",
  boardRole: "member" as const,
  variant: "modal" as const,
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe.skip("TaskDrawer", "Runner wired in epic 15. Requires RTL + Vitest + jsdom setup.", () => {
  it("renders the task title in the header", () => {
    const { TaskDrawer } = require("@/components/board/TaskDrawer");
    render(<TaskDrawer {...baseProps} />);
    expect(screen.getByText("My Task")).toBeDefined();
  });

  it("defaults to the Updates tab", () => {
    const { TaskDrawer } = require("@/components/board/TaskDrawer");
    render(<TaskDrawer {...baseProps} />);
    expect(screen.getByTestId("updates-tab")).toBeDefined();
  });

  it("renders all three tab buttons", () => {
    const { TaskDrawer } = require("@/components/board/TaskDrawer");
    render(<TaskDrawer {...baseProps} />);
    expect(screen.getByRole("tab", { name: /updates/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /activity/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /files/i })).toBeDefined();
  });

  it("hydrates store with server-fetched data on mount", () => {
    const { useBoardStore } = require("@/stores/board-store");
    const mockHydrateComments = vi.fn();
    const mockHydrateReactions = vi.fn();
    const mockHydrateActivity = vi.fn();

    useBoardStore.mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        hydrateCommentsForTask: mockHydrateComments,
        hydrateReactionsForComments: mockHydrateReactions,
        hydrateActivityForTask: mockHydrateActivity,
        columns: [],
        labelsByColumn: new Map(),
      };
      return selector(state);
    });

    const { TaskDrawer } = require("@/components/board/TaskDrawer");
    const comments = [{ id: "c1" }];
    const reactions = [
      { comment_id: "c1", user_id: "u1", emoji: "👍", board_id: "board-1", created_at: "" },
    ];
    const activity = [{ id: "a1" }];

    render(
      <TaskDrawer
        {...baseProps}
        comments={comments as never}
        reactions={reactions as never}
        activity={activity as never}
      />,
    );

    expect(mockHydrateComments).toHaveBeenCalledWith("task-1", comments);
    expect(mockHydrateReactions).toHaveBeenCalledWith(reactions);
    expect(mockHydrateActivity).toHaveBeenCalledWith("task-1", activity);
  });

  it("switching to Activity tab renders <ActivityTab />", () => {
    const { TaskDrawer } = require("@/components/board/TaskDrawer");
    const { fireEvent } = require("@testing-library/react");

    render(<TaskDrawer {...baseProps} />);
    fireEvent.click(screen.getByRole("tab", { name: /activity/i }));
    expect(screen.getByTestId("activity-tab")).toBeDefined();
  });

  it("switching to Files tab renders the placeholder", () => {
    const { TaskDrawer } = require("@/components/board/TaskDrawer");
    const { fireEvent } = require("@testing-library/react");

    render(<TaskDrawer {...baseProps} />);
    fireEvent.click(screen.getByRole("tab", { name: /files/i }));
    expect(screen.getByTestId("files-tab")).toBeDefined();
  });

  it("calls useTaskDrawerPresence with the taskId", () => {
    const { useTaskDrawerPresence } = require("@/hooks/use-task-drawer-presence");
    const { TaskDrawer } = require("@/components/board/TaskDrawer");

    render(<TaskDrawer {...baseProps} />);
    expect(useTaskDrawerPresence).toHaveBeenCalledWith("task-1");
  });
});
