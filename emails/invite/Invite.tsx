/**
 * emails/invite/Invite.tsx
 *
 * Email template for workspace and board invitation emails (board_invite kind).
 * Supports both workspace-only and board+workspace variants.
 * Supports existing-account vs new-account text variants.
 */

import { Button, Hr, Section, Text } from "@react-email/components";
import { AppShell } from "@/emails/layouts/AppShell";
import { emailTokens as t } from "@/lib/email/tokens";

export interface InviteEmailProps {
  inviterName: string;
  workspaceName: string;
  /** Set when this is a board-scoped invite; omit for workspace-only. */
  boardName?: string | undefined;
  /** Accept link: ${SITE_URL}/join/<token> */
  acceptHref: string;
  /** True when the invitee already has a Donezo account. */
  isExistingUser: boolean;
}

export function InviteEmail({
  inviterName,
  workspaceName,
  boardName,
  acceptHref,
  isExistingUser,
}: InviteEmailProps) {
  const isBoardInvite = Boolean(boardName);
  const destination = isBoardInvite
    ? `the "${boardName}" board in ${workspaceName}`
    : `the "${workspaceName}" workspace`;
  const preview = `${inviterName} invited you to ${destination} on Donezo`;

  return (
    <AppShell preview={preview}>
      <Text
        style={{
          margin: "0 0 8px",
          fontSize: t.fontSizeLg,
          fontWeight: "600",
          color: t.colorFg,
        }}
      >
        You've been invited to {destination}
      </Text>
      <Text style={{ margin: "0 0 16px", fontSize: t.fontSizeBase, color: t.colorFgMuted }}>
        <strong>{inviterName}</strong> has invited you to join Donezo.
      </Text>

      {isExistingUser ? (
        <Text style={{ margin: "0 0 16px", fontSize: t.fontSizeBase, color: t.colorFg }}>
          Click the button below to accept your invitation and start collaborating.
        </Text>
      ) : (
        <Text style={{ margin: "0 0 16px", fontSize: t.fontSizeBase, color: t.colorFg }}>
          Click the button below to create your free account and accept the invitation.
        </Text>
      )}

      <Section style={{ marginTop: "24px" }}>
        <Button
          href={acceptHref}
          style={{
            backgroundColor: t.colorPrimary,
            color: t.colorPrimaryForeground,
            borderRadius: t.radiusSm,
            padding: "10px 20px",
            fontFamily: t.fontFamily,
            fontSize: t.fontSizeBase,
            fontWeight: "600",
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Accept invitation
        </Button>
      </Section>

      <Hr style={{ borderColor: t.colorBorder, margin: "24px 0 16px" }} />

      <Text style={{ margin: "0", fontSize: t.fontSizeSm, color: t.colorFgSubtle }}>
        If you were not expecting this invitation, you can safely ignore this email. The link
        expires in 14 days.
      </Text>
    </AppShell>
  );
}
