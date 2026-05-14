import { afterEach, describe, expect, it } from "vitest";
import { type ItemDrawerTab, useItemDrawerStore } from "@/stores/item-drawer-store";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset store to initial state between tests. */
function resetStore() {
  useItemDrawerStore.getState().reset();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useItemDrawerStore", () => {
  afterEach(() => {
    resetStore();
  });

  it("starts with no open item and default tab", () => {
    const state = useItemDrawerStore.getState();
    expect(state.openItemId).toBeNull();
    expect(state.activeTab).toBe("updates");
  });

  it("open() sets openItemId and defaults to updates tab", () => {
    useItemDrawerStore.getState().open("task-abc");
    const state = useItemDrawerStore.getState();
    expect(state.openItemId).toBe("task-abc");
    expect(state.activeTab).toBe("updates");
  });

  it("open() with an explicit tab sets that tab", () => {
    useItemDrawerStore.getState().open("task-xyz", "files");
    const state = useItemDrawerStore.getState();
    expect(state.openItemId).toBe("task-xyz");
    expect(state.activeTab).toBe("files");
  });

  it("open() with activity tab sets activity tab", () => {
    useItemDrawerStore.getState().open("task-123", "activity");
    const state = useItemDrawerStore.getState();
    expect(state.openItemId).toBe("task-123");
    expect(state.activeTab).toBe("activity");
  });

  it("close() clears openItemId but preserves activeTab", () => {
    useItemDrawerStore.getState().open("task-abc", "files");
    useItemDrawerStore.getState().close();
    const state = useItemDrawerStore.getState();
    expect(state.openItemId).toBeNull();
    // close() does not reset the tab (keeps last active tab in memory)
    expect(state.activeTab).toBe("files");
  });

  it("setActiveTab() updates the active tab", () => {
    useItemDrawerStore.getState().open("task-abc");
    const tabs: ItemDrawerTab[] = ["updates", "files", "activity"];
    for (const tab of tabs) {
      useItemDrawerStore.getState().setActiveTab(tab);
      expect(useItemDrawerStore.getState().activeTab).toBe(tab);
    }
  });

  it("reset() clears openItemId and resets tab to updates", () => {
    useItemDrawerStore.getState().open("task-xyz", "activity");
    useItemDrawerStore.getState().reset();
    const state = useItemDrawerStore.getState();
    expect(state.openItemId).toBeNull();
    expect(state.activeTab).toBe("updates");
  });

  it("opening a different task replaces the previous openItemId", () => {
    useItemDrawerStore.getState().open("task-1");
    useItemDrawerStore.getState().open("task-2", "files");
    const state = useItemDrawerStore.getState();
    expect(state.openItemId).toBe("task-2");
    expect(state.activeTab).toBe("files");
  });
});
