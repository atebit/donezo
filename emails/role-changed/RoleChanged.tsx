/**
 * emails/role-changed/RoleChanged.tsx
 *
 * Email template for 'role_changed' notifications.
 */

import { Button, Section, Text } from "@react-email/components";
import { AppShell } from "@/emails/layouts/AppShell";
import { emailTokens as t } from "@/lib/email/tokens";

export interface RoleChangedEmailProps {
  actorName: string;
  /** Name of the workspace or board where the role changed. */
  contextName: string;
  /** 'workspace' | 'board' */
  contextKind: "workspace" | "board";
  fromRole: string | null;
  toRole: string;
  ctaHref: string;
}

export function RoleChangedEmail({
  actorName,
  contextName,
  contextKind,
  fromRole,
  toRole,
  ctaHref,
}: RoleChangedEmailProps) {
  const preview = `Your role in "${contextName}" has been updated`;
  const contextLabel = contextKind === "board" ? "board" : "workspace";

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
        Your {contextLabel} role has changed
      </Text>
      <Text style={{ margin: "0 0 4px", fontSize: t.fontSizeBase, color: t.colorFgMuted }}>
        <strong>{actorName}</strong> updated your role in <strong>{contextName}</strong>.
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
          {fromRole ? (
            <>
              <span style={{ color: t.colorFgMuted }}>{fromRole}</span>
              {" → "}
            </>
          ) : null}
          <strong>{toRole}</strong>
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
          Go to {contextLabel}
        </Button>
      </Section>
    </AppShell>
  );
}
