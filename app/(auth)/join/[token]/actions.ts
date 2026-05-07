"use server";
import { withUser } from "@/lib/actions";
import { AcceptInvitationSchema } from "@/lib/validations/invitation";

// NOTE: redirect must happen in the calling page (Slice F), not here.
// withUser wraps the handler in a try/catch; Next.js redirect() throws a special
// NEXT_REDIRECT error which withUser would intercept as an unexpected error.
export const acceptInvitation = withUser(async ({ supabase, userId }, raw) => {
  const input = AcceptInvitationSchema.parse(raw);

  // 1. Look up the invitation under the user's session. RLS limits visibility
  //    to invitee (matching email, not yet accepted) or admin+.
  // TODO(F1): tighten once db:types regenerates the RPC + invitation types.
  // biome-ignore lint/suspicious/noExplicitAny: invitation table not yet in generated types; F1 tightens
  const { data: inv, error: lookupError } = await (supabase as any)
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

  // 2. Insert membership under user session — RLS gated on invitation match.
  if (inv.board_id) {
    // biome-ignore lint/suspicious/noExplicitAny: board_member table not yet in generated types; F1 tightens
    const { error: bmError } = await (supabase as any)
      .from("board_member")
      .insert({ board_id: inv.board_id, user_id: userId, role: inv.role });
    if (bmError) throw { code: "DB", message: bmError.message };
  } else {
    // biome-ignore lint/suspicious/noExplicitAny: workspace_member table not yet in generated types; F1 tightens
    const { error: wmError } = await (supabase as any)
      .from("workspace_member")
      .insert({ workspace_id: inv.workspace_id, user_id: userId, role: inv.role });
    if (wmError) throw { code: "DB", message: wmError.message };
  }

  // 3. Stamp accepted_at — column-restricted via the invitation update trigger.
  // biome-ignore lint/suspicious/noExplicitAny: invitation table not yet in generated types; F1 tightens
  const { error: acceptError } = await (supabase as any)
    .from("invitation")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", inv.id);
  if (acceptError) {
    // NOTE: non-atomic. The membership insert succeeded; the invitation row stays
    // open until expiry. Acceptable trade-off for the RLS-gated flow (Q3=(b)).
    throw { code: "DB", message: acceptError.message };
  }

  return { workspaceId: inv.workspace_id, boardId: inv.board_id };
});
