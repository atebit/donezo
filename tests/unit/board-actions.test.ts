import { describe, it } from "vitest";

describe("board server actions", () => {
  it("starBoard upserts user_starred_board row on starred=true");
  it("starBoard deletes user_starred_board row on starred=false");
  it("archiveBoard sets deleted_at");
  it("restoreBoard calls restore_board RPC");
  it("deleteBoard rejects when confirmName does not match");
  it("duplicateBoard calls clone_board RPC and returns new boardId");
  it("setBoardPrivacy(true) upserts board_member with role owner");
});
