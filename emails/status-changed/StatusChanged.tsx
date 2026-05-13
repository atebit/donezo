/**
 * emails/status-changed/StatusChanged.tsx
 *
 * Email template for 'status_changed_assigned' and 'status_changed_followed' notifications.
 */

import { Button, Section, Text } from "@react-email/components";
import { AppShell } from "@/emails/layouts/AppShell";
import { emailTokens as t } from "@/lib/email/tokens";

export interface StatusChangedEmailProps {
  actorName: string;
  taskTitle: string;
  boardTitle: string;
  workspaceName: string;
  /** Null when the status was cleared or not available. */
  fromLabel: string | null;
  toLabel: string | null;
  /** 'assigned' = recipient is assigned; 'followed' = recipient follows the task */
  relationship: "assigned" | "followed";
  ctaHref: string;
}

export function StatusChangedEmail({
  actorName,
  taskTitle,
  boardTitle,
  workspaceName,
  fromLabel,
  toLabel,
  relationship,
  ctaHref,
}: StatusChangedEmailProps) {
  const relationshipText =
    relationship === "assigned" ? "a task assigned to you" : "a task you follow";
  const preview = `${actorName} changed the status of "${taskTitle}"`;

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
        Status changed on {relationshipText}
      </Text>
      <Text style={{ margin: "0 0 4px", fontSize: t.fontSizeBase, color: t.colorFgMuted }}>
        <strong>{actorName}</strong> updated <strong>{taskTitle}</strong> · {boardTitle} ·{" "}
        {workspaceName}
      </Text>
      {(fromLabel || toLabel) && (
        <Section
          style={{
            background: t.colorSurfaceInfo,
            borderRadius: t.radiusSm,
            padding: "12px 16px",
            margin: "16px 0",
          }}
        >
          <Text style={{ margin: "0", fontSize: t.fontSizeBase, color: t.colorFg }}>
            {fromLabel ? (
              <>
                <span style={{ color: t.colorFgMuted }}>{fromLabel}</span>
                {" → "}
              </>
            ) : null}
            <strong>{toLabel ?? "—"}</strong>
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
          View task
        </Button>
      </Section>
    </AppShell>
  );
}
