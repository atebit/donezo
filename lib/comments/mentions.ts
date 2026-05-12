import type { TiptapDoc, TiptapNode } from "./types";
import { EVERYONE_MENTION_ID } from "./types";

export type ExtractedMentions = {
  /** Specific user UUIDs (deduped, sentinel "everyone" stripped out). */
  userIds: string[];
  /** True if the doc contains at least one @everyone mention. */
  everyone: boolean;
};

/**
 * Walks a Tiptap doc and pulls out mentioned users + whether @everyone was used.
 * Returns `{ userIds: [], everyone: false }` for malformed or null input.
 */
export function extractMentions(doc: TiptapDoc | null | undefined): ExtractedMentions {
  const userIds = new Set<string>();
  let everyone = false;
  if (!doc || doc.type !== "doc") return { userIds: [], everyone: false };

  function walk(node: TiptapNode | undefined) {
    if (!node) return;
    if (node.type === "mention" && typeof node.attrs?.id === "string") {
      const id = node.attrs.id;
      if (id === EVERYONE_MENTION_ID) everyone = true;
      else userIds.add(id);
    }
    node.content?.forEach(walk);
  }
  doc.content?.forEach(walk);
  return { userIds: [...userIds], everyone };
}
