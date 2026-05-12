import Mention from "@tiptap/extension-mention";
import { EVERYONE_MENTION_ID } from "@/lib/comments/types";

export type MentionItem = {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

/**
 * The "Everyone" sentinel item pinned at the top of the mention list.
 * Per Q7: attrs.id = "everyone", attrs.label = "everyone".
 */
export const EVERYONE_ITEM: MentionItem = {
  id: EVERYONE_MENTION_ID,
  displayName: "Everyone on this board",
  email: null,
  avatarUrl: null,
};

/**
 * Filter mention items by query string.
 * "Everyone" is always included and pinned first regardless of query.
 */
export function filterMentionItems(items: MentionItem[], query: string): MentionItem[] {
  const q = query.toLowerCase().trim();
  const members = items.filter((item) => item.id !== EVERYONE_MENTION_ID);

  if (!q) {
    return [EVERYONE_ITEM, ...members];
  }

  const matchedMembers = members.filter((m) => {
    const name = (m.displayName ?? "").toLowerCase();
    const email = (m.email ?? "").toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  // "Everyone" is always pinned first regardless of query match quality.
  return [EVERYONE_ITEM, ...matchedMembers];
}

/**
 * Callbacks injected by the hosting React component to bridge between the
 * ProseMirror suggestion plugin lifecycle and React state.
 */
export interface MentionSuggestionBridge {
  onOpen: (items: MentionItem[], command: (item: MentionItem) => void, rect: DOMRect) => void;
  onUpdate: (items: MentionItem[], command: (item: MentionItem) => void, rect: DOMRect) => void;
  onClose: () => void;
  /** Returns true if the key event was handled (consumed). */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/**
 * Builds a configured Tiptap Mention extension.
 *
 * The suggestion rendering is handled via a bridge callback — the React host
 * (RichTextEditor) passes a `bridge` ref so the ProseMirror plugin can
 * communicate with React state without requiring tippy.js.
 */
export function buildMentionExtension(
  members: MentionItem[],
  bridge: React.RefObject<MentionSuggestionBridge | null>,
) {
  return Mention.configure({
    HTMLAttributes: {
      class: "mention-chip",
    },
    renderText({ node }) {
      return `@${node.attrs.label ?? node.attrs.id}`;
    },
    suggestion: {
      items({ query }) {
        return filterMentionItems(members, query);
      },
      render() {
        return {
          onStart(props) {
            if (!props.clientRect) return;
            const rect = props.clientRect();
            if (!rect) return;
            bridge.current?.onOpen(
              props.items as MentionItem[],
              (item: MentionItem) =>
                props.command({
                  id: item.id,
                  label:
                    item.id === EVERYONE_MENTION_ID
                      ? "everyone"
                      : (item.displayName ?? item.email ?? "Unknown"),
                }),
              rect,
            );
          },
          onUpdate(props) {
            if (!props.clientRect) return;
            const rect = props.clientRect();
            if (!rect) return;
            bridge.current?.onUpdate(
              props.items as MentionItem[],
              (item: MentionItem) =>
                props.command({
                  id: item.id,
                  label:
                    item.id === EVERYONE_MENTION_ID
                      ? "everyone"
                      : (item.displayName ?? item.email ?? "Unknown"),
                }),
              rect,
            );
          },
          onExit() {
            bridge.current?.onClose();
          },
          onKeyDown({ event }) {
            return bridge.current?.onKeyDown(event) ?? false;
          },
        };
      },
    },
  });
}

/** React namespace import needed for type usage — kept here to avoid JSX in .ts file */
import type React from "react";
