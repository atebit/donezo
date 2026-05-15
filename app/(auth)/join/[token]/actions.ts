"use server";
import { withUser } from "@/lib/actions";
// biome-ignore lint/style/noRestrictedImports: needed to seed a workspace_member
// row when accepting a board-scoped invite — wsm_insert RLS only allows
// self-insert from a workspace-scoped invitation, so the user's own client
// cannot satisfy it for the board-invite case.
import { adminClient } from "@/lib/supabase/admin";
import { AcceptInvitationSchema } from "@/lib/validations/invitation";

// NOTE: redirect must happen in the calling page (Slice F), not here.
// withUser wraps the handler in a try/catch; Next.js redirect() throws a special
// NEXT_REDIRECT error which withUser would intercept as an unexpected error.
export const acceptInvitation = withUser(async ({ supabase, userId }, raw) => {
  const input = AcceptInvitationSchema.parse(raw);

  // 1. Look up the invitation under the user's session. RLS limits visibility
  //    to invitee (matching email, not yet accepted) or admin+.
  const { data: inv, error: lookupError } = await supabase
    .from("invitation")
    .select("id, workspace_id, board_id, role, accepted_at, expires_at, email")
    .eq("token", input.token)
    .maybeSingle();
  if (lookupError) throw { code: "DB", message: lookupError.message };
  if (!inv) throw { code: "INVITATION", message: "We couldn't find that invitation." };
  if (inv.accepted_at)
    throw { code: "INVITATION", message: "That invitation has already been used." };
  if (new Date(inv.expires_at) < new Date()) {
    throw {
      code: "INVITATION",
      message: "That invitation has expired. Ask the sender to invite you again.",
    };
  }

  // 2. Upsert membership rows. We use ignoreDuplicates so that re-inviting an
  //    already-member email is a no-op at the membership layer instead of
  //    raising a 23505 unique-constraint violation that bubbles up as a raw
  //    Postgres error to the invitee.
  if (inv.board_id) {
    // 2a. Board membership (RLS-gated by the pending invitation).
    const { error: bmError } = await supabase.from("board_member").upsert(
      { board_id: inv.board_id, user_id: userId, role: inv.role },
      { onConflict: "board_id,user_id", ignoreDuplicates: true },
    );
    if (bmError) {
      console.error("[acceptInvitation] board_member upsert failed", bmError);
      throw {
        code: "INVITATION",
        message: "We couldn't add you to that board. Ask the sender to re-invite you.",
      };
    }

    // 2b. Workspace visibility. Board-only members cannot read the workspace
    //     row (workspace_select gates on is_workspace_member), so accepting a
    //     board invite would leave the invitee on the join page with no way to
    //     navigate /w/<slug>. Seed a workspace_member at viewer level. Uses
    //     adminClient because the wsm_insert RLS does not authorize self-insert
    //     for board-scoped invitations. ignoreDuplicates preserves any existing
    //     higher-privileged workspace role.
    const admin = adminClient();
    const { error: wmError } = await admin.from("workspace_member").upsert(
      { workspace_id: inv.workspace_id, user_id: userId, role: "viewer" },
      { onConflict: "workspace_id,user_id", ignoreDuplicates: true },
    );
    if (wmError) {
      console.error("[acceptInvitation] workspace_member seed failed", wmError);
      throw {
        code: "INVITATION",
        message: "We couldn't add you to that workspace. Ask the sender to re-invite you.",
      };
    }
  } else {
    // Workspace-scoped invite: invitee self-inserts under the wsm_insert RLS.
    const { error: wmError } = await supabase.from("workspace_member").upsert(
      { workspace_id: inv.workspace_id, user_id: userId, role: inv.role },
      { onConflict: "workspace_id,user_id", ignoreDuplicates: true },
    );
    if (wmError) {
      console.error("[acceptInvitation] workspace_member upsert failed", wmError);
      throw {
        code: "INVITATION",
        message: "We couldn't add you to that workspace. Ask the sender to re-invite you.",
      };
    }
  }

  // 3. Stamp accepted_at — column-restricted via the invitation update trigger.
  const { error: acceptError } = await supabase
    .from("invitation")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", inv.id);
  if (acceptError) {
    // NOTE: non-atomic. The membership insert succeeded; the invitation row stays
    // open until expiry. Acceptable trade-off for the RLS-gated flow (Q3=(b)).
    console.error("[acceptInvitation] accepted_at stamp failed", acceptError);
    throw {
      code: "INVITATION",
      message: "You've been added, but we couldn't finalize the invitation. Try refreshing.",
    };
  }

  return { workspaceId: inv.workspace_id, boardId: inv.board_id };
});
