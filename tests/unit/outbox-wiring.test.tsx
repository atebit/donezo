import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for lib/realtime/wrapped-actions.ts
 *
 * Proves that each of the four call sites routes through withOutbox with the
 * correct OutboxActionId. The wrapped constants are imported directly from the
 * factored module so we don't need to render any component.
 *
 * Strategy:
 *   - Mock the four server actions so we can track invocations.
 *   - Mock useBoardStore.getState() to control connection state.
 *   - Mock enqueueOutbox so we can assert args without real store side-effects.
 *   - With connection='offline': assert action NOT called; enqueueOutbox IS called.
 *   - With connection='connected': assert action IS called.
 *
 * All describe blocks are .skip per repo convention — vitest is enabled in epic 15.
 */

// ---- Mock sonner -----------------------------------------------------------
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

// ---- Mock the cells actions module -----------------------------------------
vi.mock("../../app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions", () => ({
  setCellValue: vi.fn(),
  bulkSetCellValue: vi.fn(),
}));

// ---- Mock the tasks actions module -----------------------------------------
vi.mock("../../app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions", () => ({
  renameTask: vi.fn(),
  moveTask: vi.fn(),
  bulkDeleteTasks: vi.fn(),
  bulkDuplicateTasks: vi.fn(),
  bulkMoveTasksToGroup: vi.fn(),
}));

// ---- Mock the groups actions module ----------------------------------------
vi.mock("../../app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions", () => ({
  renameGroup: vi.fn(),
  reorderGroup: vi.fn(),
}));

// ---- Mock board store -------------------------------------------------------
const mockEnqueueOutbox = vi.fn();
const mockState = {
  connection: "connected" as "connected" | "offline" | "reconnecting",
  outboxOverflow: false,
  outbox: [] as Array<{
    id: string;
    actionId: string;
    args: unknown[];
    optimisticUpdatedAt: number;
    enqueuedAt: number;
  }>,
  enqueueOutbox: mockEnqueueOutbox,
  dequeueOutbox: vi.fn(),
};

vi.mock("../../stores/board-store", () => ({
  useBoardStore: {
    getState: () => mockState,
    setState: (patch: Partial<typeof mockState>) => {
      Object.assign(mockState, patch);
    },
  },
}));

// ---- Import mocked modules (after vi.mock calls) ---------------------------
// Dynamic import ensures vi.mock hoisting is in effect before the module loads.

type WrappedActionsModule = typeof import("../../lib/realtime/wrapped-actions");
type CellActionsModule =
  typeof import("../../app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions");
type TaskActionsModule =
  typeof import("../../app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions");
type GroupActionsModule =
  typeof import("../../app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions");

async function getWrapped(): Promise<WrappedActionsModule> {
  return import("../../lib/realtime/wrapped-actions");
}
async function getCellActions(): Promise<CellActionsModule> {
  return import("../../app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions");
}
async function getTaskActions(): Promise<TaskActionsModule> {
  return import("../../app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions");
}
async function getGroupActions(): Promise<GroupActionsModule> {
  return import("../../app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions");
}

// ---- Helpers ---------------------------------------------------------------

function setOffline() {
  mockState.connection = "offline";
}

function setConnected() {
  mockState.connection = "connected";
  // navigator.onLine defaults to true in jsdom — no override needed
}

function resetState() {
  mockState.connection = "connected";
  mockState.outboxOverflow = false;
  mockState.outbox = [];
}

// ---- Tests -----------------------------------------------------------------

describe("wrappedSetCellValue (CellEditor call site)", () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
  });

  it("enqueues with actionId='setCellValue' when offline; does NOT call setCellValue", async () => {
    const { wrappedSetCellValue } = await getWrapped();
    const { setCellValue } = await getCellActions();

    setOffline();
    const args = { taskId: "task-1", columnId: "col-1", value: "hello" };
    const result = await wrappedSetCellValue(args);

    expect(result).toEqual({ queued: true });
    expect(setCellValue).not.toHaveBeenCalled();
    expect(mockEnqueueOutbox).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: "setCellValue",
        args: [args],
      }),
    );
  });

  it("calls setCellValue directly when connected; does NOT enqueue", async () => {
    const { wrappedSetCellValue } = await getWrapped();
    const { setCellValue } = await getCellActions();

    setConnected();
    const mockResult = { ok: true, data: { task_id: "task-1", column_id: "col-1" } };
    // @ts-expect-error vi.fn() mock
    setCellValue.mockResolvedValue(mockResult);

    const args = { taskId: "task-1", columnId: "col-1", value: "hello" };
    const result = await wrappedSetCellValue(args);

    expect(result).toEqual(mockResult);
    expect(setCellValue).toHaveBeenCalledWith(args);
    expect(mockEnqueueOutbox).not.toHaveBeenCalled();
  });
});

describe("wrappedRenameTask (TaskTitleCell call site)", () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
  });

  it("enqueues with actionId='renameTask' when offline; does NOT call renameTask", async () => {
    const { wrappedRenameTask } = await getWrapped();
    const { renameTask } = await getTaskActions();

    setOffline();
    const args = { taskId: "task-2", title: "New Title" };
    const result = await wrappedRenameTask(args);

    expect(result).toEqual({ queued: true });
    expect(renameTask).not.toHaveBeenCalled();
    expect(mockEnqueueOutbox).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: "renameTask",
        args: [args],
      }),
    );
  });

  it("calls renameTask directly when connected; does NOT enqueue", async () => {
    const { wrappedRenameTask } = await getWrapped();
    const { renameTask } = await getTaskActions();

    setConnected();
    const mockResult = { ok: true, data: { id: "task-2", title: "New Title" } };
    // @ts-expect-error vi.fn() mock
    renameTask.mockResolvedValue(mockResult);

    const args = { taskId: "task-2", title: "New Title" };
    const result = await wrappedRenameTask(args);

    expect(result).toEqual(mockResult);
    expect(renameTask).toHaveBeenCalledWith(args);
    expect(mockEnqueueOutbox).not.toHaveBeenCalled();
  });
});

describe("wrappedRenameGroup (BoardTable/GroupHeaderRow call site)", () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
  });

  it("enqueues with actionId='renameGroup' when offline; does NOT call renameGroup", async () => {
    const { wrappedRenameGroup } = await getWrapped();
    const { renameGroup } = await getGroupActions();

    setOffline();
    const args = { groupId: "group-1", name: "Renamed Group" };
    const result = await wrappedRenameGroup(args);

    expect(result).toEqual({ queued: true });
    expect(renameGroup).not.toHaveBeenCalled();
    expect(mockEnqueueOutbox).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: "renameGroup",
        args: [args],
      }),
    );
  });

  it("calls renameGroup directly when connected; does NOT enqueue", async () => {
    const { wrappedRenameGroup } = await getWrapped();
    const { renameGroup } = await getGroupActions();

    setConnected();
    const mockResult = { ok: true, data: { id: "group-1", name: "Renamed Group" } };
    // @ts-expect-error vi.fn() mock
    renameGroup.mockResolvedValue(mockResult);

    const args = { groupId: "group-1", name: "Renamed Group" };
    const result = await wrappedRenameGroup(args);

    expect(result).toEqual(mockResult);
    expect(renameGroup).toHaveBeenCalledWith(args);
    expect(mockEnqueueOutbox).not.toHaveBeenCalled();
  });
});

describe("wrappedBulkSetCellValue (BulkActionBar call site)", () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
  });

  it("enqueues with actionId='bulkSetCellValue' when offline; does NOT call bulkSetCellValue", async () => {
    const { wrappedBulkSetCellValue } = await getWrapped();
    const { bulkSetCellValue } = await getCellActions();

    setOffline();
    const args = { taskIds: ["task-1", "task-2"], columnId: "col-1", value: "done" };
    const result = await wrappedBulkSetCellValue(args);

    expect(result).toEqual({ queued: true });
    expect(bulkSetCellValue).not.toHaveBeenCalled();
    expect(mockEnqueueOutbox).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: "bulkSetCellValue",
        args: [args],
      }),
    );
  });

  it("calls bulkSetCellValue directly when connected; does NOT enqueue", async () => {
    const { wrappedBulkSetCellValue } = await getWrapped();
    const { bulkSetCellValue } = await getCellActions();

    setConnected();
    const mockResult = { ok: true, data: { cells: [] } };
    // @ts-expect-error vi.fn() mock
    bulkSetCellValue.mockResolvedValue(mockResult);

    const args = { taskIds: ["task-1", "task-2"], columnId: "col-1", value: "done" };
    const result = await wrappedBulkSetCellValue(args);

    expect(result).toEqual(mockResult);
    expect(bulkSetCellValue).toHaveBeenCalledWith(args);
    expect(mockEnqueueOutbox).not.toHaveBeenCalled();
  });
});
