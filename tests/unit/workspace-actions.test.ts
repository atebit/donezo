// @ts-expect-error vitest runner wired in epic 15
import { describe, it } from "vitest";

describe.skip("workspace server actions", () => {
  it("renameWorkspace updates workspace.name and revalidates tag");
  it("updateWorkspaceSlug returns VALIDATION error on 23505");
  it("deleteWorkspace rejects when confirmName does not match");
  it("revokeInvitation sets revoked_at");
  it("resendInvitation extends expires_at by 14 days");
});
