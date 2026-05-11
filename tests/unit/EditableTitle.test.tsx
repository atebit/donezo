// @ts-expect-error vitest is wired in epic 15
import { describe, it } from "vitest";

// Tests deferred: vitest runner wired in epic 15
describe.skip("EditableTitle", () => {
  it("Enter commits the value", async () => {
    // TODO: render <EditableTitle initialValue="foo" onCommit={...} />,
    // simulate Enter, assert onCommit called with "foo"
  });

  it("Esc reverts to initialValue", async () => {
    // TODO: render, type new value, press Esc, assert displayed value is initialValue
  });

  it("Empty trimmed value reverts without calling onCommit", async () => {
    // TODO
  });

  it("onCommit throw triggers revert and shows toast", async () => {
    // TODO
  });
});
