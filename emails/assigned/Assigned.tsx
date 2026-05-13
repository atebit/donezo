/**
 * emails/assigned/Assigned.tsx
 *
 * Email template for 'assigned' notifications.
 */

import { Button, Section, Text } from "@react-email/components";
import { AppShell } from "@/emails/layouts/AppShell";
import { emailTokens as t } from "@/lib/email/tokens";

export interface AssignedEmailProps {
  actorName: string;
  taskTitle: string;
  boardTitle: string;
  workspaceName: string;
  ctaHref: string;
}

export function AssignedEmail({
  actorName,
  taskTitle,
  boardTitle,
  workspaceName,
  ctaHref,
}: AssignedEmailProps) {
  const preview = `${actorName} assigned you to "${taskTitle}"`;
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
        {actorName} assigned you to a task
      </Text>
      <Text style={{ margin: "0 0 16px", fontSize: t.fontSizeBase, color: t.colorFgMuted }}>
        <strong>{taskTitle}</strong> in {boardTitle} · {workspaceName}
      </Text>
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
          View task
        </Button>
      </Section>
    </AppShell>
  );
}
