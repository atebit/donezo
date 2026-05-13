import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoardActivityFilters } from "../../components/activity/BoardActivityFilters";
import type { ActivityFilters } from "../../lib/validations/activity";

/**
 * Unit tests for <BoardActivityFilters />.
 *
 * NOTE: These tests cannot run until Vitest + @testing-library/react are wired in epic 15.
 *
 * Covers:
 *   - Actor multi-select renders members and emits correct actorIds
 *   - Action group checkboxes render and emit correct actionGroups
 *   - Date inputs render and emit ISO datetime strings
 *   - Unchecking removes from array; empty array becomes undefined
 */

const MEMBERS = [
  { id: "user-1", displayName: "Alice", email: "alice@example.com" },
  { id: "user-2", displayName: "Bob", email: "bob@example.com" },
];

describe("BoardActivityFilters", () => {
  it("renders member checkboxes for each member", () => {
    const onChange = vi.fn();
    render(<BoardActivityFilters value={{}} onChange={onChange} members={MEMBERS} />);

    expect(screen.getByLabelText("Filter by Alice")).toBeTruthy();
    expect(screen.getByLabelText("Filter by Bob")).toBeTruthy();
  });

  it("checking a member adds their id to actorIds", () => {
    const onChange = vi.fn();
    render(<BoardActivityFilters value={{}} onChange={onChange} members={MEMBERS} />);

    fireEvent.click(screen.getByLabelText("Filter by Alice"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ actorIds: ["user-1"] }));
  });

  it("unchecking a member removes their id; empty array becomes undefined", () => {
    const onChange = vi.fn();
    const value: ActivityFilters = { actorIds: ["user-1"] };
    render(<BoardActivityFilters value={value} onChange={onChange} members={MEMBERS} />);

    fireEvent.click(screen.getByLabelText("Filter by Alice"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ actorIds: undefined }));
  });

  it("renders all 6 action group checkboxes", () => {
    render(<BoardActivityFilters value={{}} onChange={vi.fn()} />);

    const groups = ["Tasks", "Groups", "Columns", "Cells", "Comments", "Labels"];
    for (const label of groups) {
      expect(screen.getByLabelText(`Filter by ${label}`)).toBeTruthy();
    }
  });

  it("checking an action group adds it to actionGroups", () => {
    const onChange = vi.fn();
    render(<BoardActivityFilters value={{}} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText("Filter by Tasks"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ actionGroups: ["task"] }));
  });

  it("unchecking an action group removes it; empty becomes undefined", () => {
    const onChange = vi.fn();
    const value: ActivityFilters = { actionGroups: ["task"] };
    render(<BoardActivityFilters value={value} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText("Filter by Tasks"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ actionGroups: undefined }));
  });

  it("multiple action groups can be selected simultaneously", () => {
    const onChange = vi.fn();
    const value: ActivityFilters = { actionGroups: ["task"] };
    render(<BoardActivityFilters value={value} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText("Filter by Comments"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ actionGroups: ["task", "comment"] }),
    );
  });

  it("dateFrom input emits ISO datetime string with T00:00:00.000Z suffix", () => {
    const onChange = vi.fn();
    render(<BoardActivityFilters value={{}} onChange={onChange} />);

    const input = screen.getByLabelText("Filter from date") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2024-01-15" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ dateFrom: "2024-01-15T00:00:00.000Z" }),
    );
  });

  it("dateTo input emits ISO datetime string with T23:59:59.999Z suffix", () => {
    const onChange = vi.fn();
    render(<BoardActivityFilters value={{}} onChange={onChange} />);

    const input = screen.getByLabelText("Filter to date") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2024-01-31" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ dateTo: "2024-01-31T23:59:59.999Z" }),
    );
  });

  it("clearing dateFrom input emits dateFrom: undefined", () => {
    const onChange = vi.fn();
    const value: ActivityFilters = { dateFrom: "2024-01-15T00:00:00.000Z" };
    render(<BoardActivityFilters value={value} onChange={onChange} />);

    const input = screen.getByLabelText("Filter from date") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dateFrom: undefined }));
  });

  it("does not render actor section when no members provided", () => {
    render(<BoardActivityFilters value={{}} onChange={vi.fn()} />);
    // Actor section only renders when members.length > 0
    expect(screen.queryByText("Actor")).toBeNull();
  });

  it("emits correct combined ActivityFilters shape with actor + group + dates", () => {
    const onChange = vi.fn();
    render(<BoardActivityFilters value={{}} onChange={onChange} members={MEMBERS} />);

    // Simulate multiple interactions
    fireEvent.click(screen.getByLabelText("Filter by Alice"));
    expect(onChange).toHaveBeenLastCalledWith({
      actorIds: ["user-1"],
    });
  });
});
