/**
 * emails/comment-on-followed/CommentOnFollowed.tsx
 *
 * Email template for 'comment_on_followed' notifications.
 * Fires when someone comments on a task the recipient is following.
 */

import { Button, Section, Text } from "@react-email/components";
import { AppShell } from "@/emails/layouts/AppShell";
import { emailTokens as t } from "@/lib/email/tokens";

export interface CommentOnFollowedEmailProps {
  actorName: string;
  taskTitle: string;
  boardTitle: string;
  workspaceName: string;
  commentPreview: string;
  ctaHref: string;
}

export function CommentOnFollowedEmail({
  actorName,
  taskTitle,
  boardTitle,
  workspaceName,
  commentPreview,
  ctaHref,
}: CommentOnFollowedEmailProps) {
  const preview = `${actorName} commented on "${taskTitle}"`;
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
        New comment on a task you follow
      </Text>
      <Text style={{ margin: "0 0 4px", fontSize: t.fontSizeBase, color: t.colorFgMuted }}>
        <strong>{actorName}</strong> commented on <strong>{taskTitle}</strong> · {boardTitle} ·{" "}
        {workspaceName}
      </Text>
      {commentPreview && (
        <Section
          style={{
            borderLeft: `3px solid ${t.colorBorderStrong}`,
            paddingLeft: "12px",
            margin: "16px 0",
          }}
        >
          <Text
            style={{
              margin: "0",
              fontSize: t.fontSizeBase,
              color: t.colorFgMuted,
              fontStyle: "italic",
              lineHeight: t.lineHeightBase,
            }}
          >
            {commentPreview}
          </Text>
        </Section>
      )}
      <Section style={{ marginTop: "24px" }}>
        <Button
          href={ctaHref}
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
          View comment
        </Button>
      </Section>
    </AppShell>
  );
}
