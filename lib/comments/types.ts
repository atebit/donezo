// Tiptap doc shape — JSON-serializable subset we persist in comment.body.
// The full schema lives in @tiptap/pm; this is the narrow contract.
export type TiptapDoc = {
  type: "doc";
  content?: TiptapNode[];
};

export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
};

// Mention node attrs.
// id is either a user UUID, or the sentinel "everyone" for board-wide mentions.
export type MentionAttrs = {
  id: string;
  label: string;
};

export const EVERYONE_MENTION_ID = "everyone" as const;
