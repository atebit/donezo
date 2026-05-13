/**
 * emails/layouts/AppShell.tsx
 *
 * Shared header/footer wrapper for all Donezo transactional emails.
 * All styles are inline (email-safe). No external CSS.
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { emailTokens as t } from "@/lib/email/tokens";

export interface AppShellProps {
  preview: string;
  children: ReactNode;
}

export function AppShell({ preview, children }: AppShellProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: t.colorSurfaceAuth,
          fontFamily: t.fontFamily,
          fontSize: t.fontSizeBase,
          color: t.colorFg,
          margin: "0",
          padding: "0",
        }}
      >
        <Container
          style={{
            maxWidth: t.containerWidth,
            margin: "0 auto",
            padding: "24px 16px",
          }}
        >
          {/* Header */}
          <Section
            style={{
              backgroundColor: t.colorSurface,
              borderRadius: `${t.radiusMd} ${t.radiusMd} 0 0`,
              padding: "24px 32px 20px",
              borderBottom: `1px solid ${t.colorBorder}`,
            }}
          >
            <Heading
              style={{
                margin: "0",
                fontSize: t.fontSizeXl,
                fontWeight: "700",
                color: t.colorPrimary,
                letterSpacing: "-0.3px",
              }}
            >
              Donezo
            </Heading>
          </Section>

          {/* Content */}
          <Section
            style={{
              backgroundColor: t.colorSurface,
              padding: "32px 32px 24px",
            }}
          >
            {children}
          </Section>

          {/* Footer */}
          <Section
            style={{
              backgroundColor: t.colorSurface,
              borderRadius: `0 0 ${t.radiusMd} ${t.radiusMd}`,
              borderTop: `1px solid ${t.colorBorder}`,
              padding: "20px 32px",
            }}
          >
            <Text
              style={{
                margin: "0",
                fontSize: t.fontSizeSm,
                color: t.colorFgMuted,
                lineHeight: t.lineHeightBase,
              }}
            >
              You are receiving this email because you have notifications enabled in your{" "}
              <a
                href="{{{SITE_URL}}}/account/notifications"
                style={{ color: t.colorLink, textDecoration: "underline" }}
              >
                Donezo account settings
              </a>
              . To unsubscribe or adjust your preferences, visit your notification settings.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
