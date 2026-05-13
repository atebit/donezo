/**
 * lib/email/digest-types.ts
 *
 * Shared DigestData interface used by:
 *   - emails/digest/Digest.tsx  (template, owned by slice 2C)
 *   - lib/email/digest.ts       (aggregator, owned by slice 2D)
 *
 * Keeping the type in a neutral file lets 2C and 2D land in parallel
 * without a file-ownership race.
 */

import type { NotificationKind } from "@/lib/notifications/kinds";

export type DigestData = {
  recipient: { displayName: string; email: string };
  counts: {
    mentions: number;
    statusChanges: number;
    assigned: number;
    commentsOnFollowed: number;
    total: number;
  };
  sections: Array<{
    board: { id: string; title: string; workspaceSlug: string };
    items: Array<{
      id: string;
      kind: NotificationKind;
      actor: { name: string };
      task: { id: string; title: string };
      createdAt: string;
      href: string;
    }>;
    moreCount: number;
  }>;
  generatedAt: string;
};
