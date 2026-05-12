// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it } from "vitest";
import { extractMentions } from "../../lib/comments/mentions";
import type { TiptapDoc } from "../../lib/comments/types";

/**
 * Unit tests for lib/comments/mentions.ts — extractMentions.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * Written now so epic 15 executor can pick them up without changes.
 */

describe("extractMentions", () => {
  it("empty doc returns { userIds: [], everyone: false }", () => {
    const doc: TiptapDoc = { type: "doc", content: [] };
    expect(extractMentions(doc)).toEqual({ userIds: [], everyone: false });
  });

  it("doc with one user mention returns { userIds: [id], everyone: false }", () => {
    const userId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: { id: userId, label: "Alice" },
            },
          ],
        },
      ],
    };
    expect(extractMentions(doc)).toEqual({ userIds: [userId], everyone: false });
  });

  it("doc with @everyone only returns { userIds: [], everyone: true }", () => {
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "mention",
              attrs: { id: "everyone", label: "everyone" },
            },
          ],
        },
      ],
    };
    expect(extractMentions(doc)).toEqual({ userIds: [], everyone: true });
  });

  it("doc with @everyone and two user mentions returns both flagged", () => {
    const userId1 = "aaaaaaaa-0000-0000-0000-000000000001";
    const userId2 = "aaaaaaaa-0000-0000-0000-000000000002";
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "mention", attrs: { id: "everyone", label: "everyone" } },
            { type: "mention", attrs: { id: userId1, label: "Alice" } },
            { type: "mention", attrs: { id: userId2, label: "Bob" } },
          ],
        },
      ],
    };
    const result = extractMentions(doc);
    expect(result.everyone).toBe(true);
    expect(result.userIds).toHaveLength(2);
    expect(result.userIds).toContain(userId1);
    expect(result.userIds).toContain(userId2);
  });

  it("nested mentions inside lists/blockquotes (quote-reply scenario) are collected", () => {
    const userId = "bbbbbbbb-0000-0000-0000-000000000001";
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Quoted text" },
              ],
            },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "mention", attrs: { id: userId, label: "Charlie" } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(extractMentions(doc)).toEqual({ userIds: [userId], everyone: false });
  });

  it("duplicate user ids are deduped", () => {
    const userId = "cccccccc-0000-0000-0000-000000000001";
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "mention", attrs: { id: userId, label: "Dave" } },
            { type: "mention", attrs: { id: userId, label: "Dave" } },
          ],
        },
      ],
    };
    const result = extractMentions(doc);
    expect(result.userIds).toHaveLength(1);
    expect(result.userIds[0]).toBe(userId);
  });

  it("malformed nodes (no attrs, wrong type) are ignored — no throw", () => {
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "normal text" },
            { type: "mention" }, // no attrs
            { type: "hardBreak" },
          ],
        },
      ],
    };
    expect(() => extractMentions(doc)).not.toThrow();
    expect(extractMentions(doc)).toEqual({ userIds: [], everyone: false });
  });

  it("null input returns empty result", () => {
    expect(extractMentions(null)).toEqual({ userIds: [], everyone: false });
  });

  it("undefined input returns empty result", () => {
    expect(extractMentions(undefined)).toEqual({ userIds: [], everyone: false });
  });

  it("wrong-shape input (not a doc) returns empty result", () => {
    // @ts-expect-error: intentionally passing wrong shape
    expect(extractMentions({ type: "paragraph" })).toEqual({ userIds: [], everyone: false });
  });

  it("attrs.id that is not a string is ignored", () => {
    const doc: TiptapDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            // @ts-expect-error: intentionally wrong attr type
            { type: "mention", attrs: { id: 12345, label: "invalid" } },
          ],
        },
      ],
    };
    expect(extractMentions(doc)).toEqual({ userIds: [], everyone: false });
  });
});
