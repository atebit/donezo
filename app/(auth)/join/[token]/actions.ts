"use server";
import { withUser } from "@/lib/actions";
import { logger } from "@/lib/logger";
import { AcceptInvitationSchema } from "@/lib/validations/invitation";

// NOTE: redirect must happen in the calling page (Slice F), not here.
// withUser wraps the handler in a try/catch; Next.js redirect() throws a special
// NEXT_REDIRECT error which withUser would intercept as an unexpected error.
//
// Acceptance is delegated to the accept_invitation SECURITY DEFINER RPC. The
// self-insert RLS path (bm_insert/wsm_insert "via a valid invitation") is a
// chicken-and-egg trap that rejects genuine brand-new invitees in production;
// the RPC re-validates authorization (caller email matches a live, unrevoked
// invitation for the token) and performs the writes with definer privileges.
export const acceptInvitation = withUser(async ({ supabase }, raw) => {
  const input = AcceptInvitationSchema.parse(raw);

  const { data, error } = await supabase
    .rpc("accept_invitation", { p_token: input.token })
    .single();

  if (error) {
    logger.error({ err: error }, "[acceptInvitation] accept_invitation rpc failed");
    // Map known RAISE errcodes to user-safe copy; never leak raw PG strings.
    const message =
      error.code === "P0002"
        ? "We couldn't find that invitation."
        : /expired/i.test(error.message)
          ? "That invitation has expired. Ask the sender to invite you again."
          : /revoked/i.test(error.message)
            ? "That invitation has been revoked."
            : /different email/i.test(error.message)
              ? "This invitation was sent to a different email address."
              : "We couldn't accept that invitation. Ask the sender to re-invite you.";
    throw { code: "INVITATION", message };
  }

  return { workspaceId: data.workspace_id, boardId: data.board_id };
});
