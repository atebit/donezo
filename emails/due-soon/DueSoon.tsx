/**
 * emails/due-soon/DueSoon.tsx
 *
 * Email template for 'due_soon' and 'due_overdue' notifications.
 */

import { Button, Section, Text } from "@react-email/components";
import { AppShell } from "@/emails/layouts/AppShell";
import { emailTokens as t } from "@/lib/email/tokens";

export interface DueSoonEmailProps {
  taskTitle: string;
  boardTitle: string;
  workspaceName: string;
  dueDate: string;
  /** 'due_soon' = upcoming; 'due_overdue' = already past */
  variant: "due_soon" | "due_overdue";
  ctaHref: string;
}

export function DueSoonEmail({
  taskTitle,
  boardTitle,
  workspaceName,
  dueDate,
  variant,
  ctaHref,
}: DueSoonEmailProps) {
  const isOverdue = variant === "due_overdue";
  const preview = isOverdue ? `"${taskTitle}" is overdue` : `"${taskTitle}" is due soon`;
  const headingText = isOverdue ? "Task overdue" : "Task due soon";
  const urgencyColor = isOverdue ? "#e44258" : "#f59e0b";

  return (
    <AppShell preview={preview}>
      <Text
        style={{
          margin: "0 0 8px",
          fontSize: t.fontSizeLg,
          fontWeight: "600",
          color: urgencyColor,
        }}
      >
        {headingText}
      </Text>
      <Text style={{ margin: "0 0 4px", fontSize: t.fontSizeBase, color: t.colorFgMuted }}>
        <strong>{taskTitle}</strong> · {boardTitle} · {workspaceName}
      </Text>
      <Section
        style={{
          background: t.colorSurfaceInfo,
          borderRadius: t.radiusSm,
          padding: "12px 16px",
          margin: "16px 0",
        }}
      >
        <Text style={{ margin: "0", fontSize: t.fontSizeBase, color: t.colorFg }}>
          Due: <strong>{dueDate}</strong>
        </Text>
      </Section>
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
