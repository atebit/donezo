/**
 * emails/digest/Digest.tsx
 *
 * Email template for digest notifications.
 * Data wiring (aggregation) lives in lib/email/digest.ts (slice 2D).
 * The DigestData type lives in lib/email/digest-types.ts (shared).
 */

import { Hr, Section, Text } from "@react-email/components";
import { AppShell } from "@/emails/layouts/AppShell";
import type { DigestData } from "@/lib/email/digest-types";
import { emailTokens as t } from "@/lib/email/tokens";

export interface DigestEmailProps {
  data: DigestData;
}

export function DigestEmail({ data }: DigestEmailProps) {
  const { recipient, counts, sections, generatedAt } = data;
  const preview = `Your Donezo digest — ${counts.total} notification${counts.total !== 1 ? "s" : ""}`;

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
        Your notification digest
      </Text>
      <Text style={{ margin: "0 0 4px", fontSize: t.fontSizeBase, color: t.colorFgMuted }}>
        Hi {recipient.displayName}, here's what you missed:
      </Text>

      {/* Summary counts */}
      <Section
        style={{
          background: t.colorSurfaceInfo,
          borderRadius: t.radiusSm,
          padding: "12px 16px",
          margin: "16px 0",
        }}
      >
        <Text style={{ margin: "0", fontSize: t.fontSizeBase, color: t.colorFg }}>
          {counts.mentions > 0 && (
            <>
              <strong>{counts.mentions}</strong> mention
              {counts.mentions !== 1 ? "s" : ""}
              {"  "}
            </>
          )}
          {counts.assigned > 0 && (
            <>
              <strong>{counts.assigned}</strong> assignment
              {counts.assigned !== 1 ? "s" : ""}
              {"  "}
            </>
          )}
          {counts.statusChanges > 0 && (
            <>
              <strong>{counts.statusChanges}</strong> status change
              {counts.statusChanges !== 1 ? "s" : ""}
              {"  "}
            </>
          )}
          {counts.commentsOnFollowed > 0 && (
            <>
              <strong>{counts.commentsOnFollowed}</strong> comment
              {counts.commentsOnFollowed !== 1 ? "s" : ""} on followed tasks
            </>
          )}
        </Text>
      </Section>

      {/* Per-board sections */}
      {sections.map((section) => (
        <Section key={section.board.id} style={{ marginBottom: "24px" }}>
          <Text
            style={{
              margin: "0 0 8px",
              fontSize: t.fontSizeBase,
              fontWeight: "700",
              color: t.colorFg,
            }}
          >
            {section.board.title}
          </Text>
          {section.items.map((item) => (
            <Section
              key={item.id}
              style={{
                borderLeft: `3px solid ${t.colorBorder}`,
                paddingLeft: "12px",
                marginBottom: "8px",
              }}
            >
              <Text style={{ margin: "0", fontSize: t.fontSizeBase, color: t.colorFgMuted }}>
                <a href={item.href} style={{ color: t.colorLink, textDecoration: "none" }}>
                  <strong>{item.actor.name}</strong> · {item.task.title}
                </a>
              </Text>
            </Section>
          ))}
          {section.moreCount > 0 && (
            <Text style={{ margin: "0", fontSize: t.fontSizeSm, color: t.colorFgSubtle }}>
              +{section.moreCount} more notification{section.moreCount !== 1 ? "s" : ""}
            </Text>
          )}
        </Section>
      ))}

      <Hr style={{ borderColor: t.colorBorder, margin: "24px 0 16px" }} />

      <Text style={{ margin: "0", fontSize: t.fontSizeSm, color: t.colorFgSubtle }}>
        Generated at {generatedAt}.
      </Text>
    </AppShell>
  );
}
