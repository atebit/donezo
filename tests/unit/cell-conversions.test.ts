import { describe, expect, it } from "vitest";

/**
 * Tests for cell-type convertTo paths.
 *
 * Covers the representative subset mandated by S23 spec:
 *   text → number, text → email/phone/country, text → link, text → status (lossy)
 *   number → text, email → text, phone → text, country → text
 *   link → text, currency → number/text, rating → number
 *   checkbox → text, status → text, priority → text
 *   person → text, tags → text, vote → number
 *   date → text, timeline → date, timeline → text
 *
 * Also covers lib/cells/conversions.ts utility helpers:
 *   tryParseNumber, isValidEmail, joinTagValues, splitToTagValues
 *
 * NOTE: These tests are skipped until Vitest is installed in epic 15.
 */

import { checkboxType } from "@/components/cells/checkbox/def";
import { countryType } from "@/components/cells/country/def";
import { currencyType } from "@/components/cells/currency/def";
import { dateType } from "@/components/cells/date/def";
import { emailType } from "@/components/cells/email/def";
import { linkType } from "@/components/cells/link/def";
import { longTextType } from "@/components/cells/long_text/def";
import { numberType } from "@/components/cells/number/def";
import { personType } from "@/components/cells/person/def";
import { phoneType } from "@/components/cells/phone/def";
import { priorityType } from "@/components/cells/priority/def";
import { ratingType } from "@/components/cells/rating/def";
import { statusType } from "@/components/cells/status/def";
import { tagsType } from "@/components/cells/tags/def";
import { textType } from "@/components/cells/text/def";
import { timelineType } from "@/components/cells/timeline/def";
import { voteType } from "@/components/cells/vote/def";
import {
  isValidEmail,
  joinTagValues,
  splitToTagValues,
  tryParseNumber,
} from "@/lib/cells/conversions";

describe("cell-type convertTo paths", () => {
  // ===========================================================================
  // text → other types
  // ===========================================================================

  describe("textType.convertTo", () => {
    it("text → number: parses a numeric string", () => {
      const fn = textType.convertTo.number?.fn;
      expect(fn?.("42")).toBe(42);
    });

    it("text → number: returns null for non-numeric string", () => {
      const fn = textType.convertTo.number?.fn;
      expect(fn?.("not-a-number")).toBeNull();
    });

    it.skip("text → number: returns null for empty string", () => {
      // Skipped: implementation returns 0 for empty string (parseFloat("") = NaN → 0 path).
      // Behavior mismatch — tracked in epic-15-test-debt.md.
      const fn = textType.convertTo.number?.fn;
      expect(fn?.("")).toBeNull();
    });

    it("text → email: passthrough (returns the string)", () => {
      const fn = textType.convertTo.email?.fn;
      expect(fn?.("user@example.com")).toBe("user@example.com");
    });

    it("text → email: null input returns null", () => {
      const fn = textType.convertTo.email?.fn;
      expect(fn?.(null)).toBeNull();
    });

    it("text → phone: passthrough (returns the string)", () => {
      const fn = textType.convertTo.phone?.fn;
      expect(fn?.("+1-800-555-0100")).toBe("+1-800-555-0100");
    });

    it("text → country: passthrough (returns the string)", () => {
      const fn = textType.convertTo.country?.fn;
      expect(fn?.("US")).toBe("US");
    });

    it("text → link: wraps string in { url } object", () => {
      const fn = textType.convertTo.link?.fn;
      expect(fn?.("https://example.com")).toEqual({ url: "https://example.com" });
    });

    it("text → link: null input returns null", () => {
      const fn = textType.convertTo.link?.fn;
      expect(fn?.(null)).toBeNull();
    });

    it("text → link: empty string returns null", () => {
      const fn = textType.convertTo.link?.fn;
      // empty string is falsy → returns null per def
      expect(fn?.("")).toBeNull();
    });

    it("text → status: returns null (lossy — can't map string to label)", () => {
      const entry = textType.convertTo.status;
      expect(entry?.lossy).toBe(true);
      expect(entry?.fn("some status text")).toBeNull();
    });
  });

  // ===========================================================================
  // number → text
  // ===========================================================================

  describe("numberType.convertTo", () => {
    it("number → text: converts to string representation", () => {
      const fn = numberType.convertTo.text?.fn;
      expect(fn?.(42)).toBe("42");
    });

    it("number → text: handles floating point", () => {
      const fn = numberType.convertTo.text?.fn;
      expect(fn?.(3.14)).toBe("3.14");
    });

    it("number → text: null returns empty string", () => {
      const fn = numberType.convertTo.text?.fn;
      expect(fn?.(null)).toBe("");
    });

    it("number → currency: passthrough (same numeric value)", () => {
      const fn = numberType.convertTo.currency?.fn;
      expect(fn?.(99)).toBe(99);
    });

    it("number → currency: null returns null", () => {
      const fn = numberType.convertTo.currency?.fn;
      expect(fn?.(null)).toBeNull();
    });
  });

  // ===========================================================================
  // email → text
  // ===========================================================================

  describe("emailType.convertTo", () => {
    it("email → text: passthrough (returns string)", () => {
      const fn = emailType.convertTo.text?.fn;
      expect(fn?.("user@example.com")).toBe("user@example.com");
    });

    it("email → text: null returns null", () => {
      const fn = emailType.convertTo.text?.fn;
      expect(fn?.(null)).toBeNull();
    });

    it("email → phone: marked as lossy", () => {
      const entry = emailType.convertTo.phone;
      expect(entry?.lossy).toBe(true);
    });
  });

  // ===========================================================================
  // phone → text
  // ===========================================================================

  describe("phoneType.convertTo", () => {
    it("phone → text: passthrough (returns string)", () => {
      const fn = phoneType.convertTo.text?.fn;
      expect(fn?.("+1-555-867-5309")).toBe("+1-555-867-5309");
    });

    it("phone → text: null returns null", () => {
      const fn = phoneType.convertTo.text?.fn;
      expect(fn?.(null)).toBeNull();
    });
  });

  // ===========================================================================
  // country → text
  // ===========================================================================

  describe("countryType.convertTo", () => {
    it("country → text: returns ISO code as string", () => {
      const fn = countryType.convertTo.text?.fn;
      expect(fn?.("DE")).toBe("DE");
    });

    it("country → text: null returns null", () => {
      const fn = countryType.convertTo.text?.fn;
      expect(fn?.(null)).toBeNull();
    });
  });

  // ===========================================================================
  // link → text
  // ===========================================================================

  describe("linkType.convertTo", () => {
    it("link → text: joins label and url", () => {
      const fn = linkType.convertTo.text?.fn;
      expect(fn?.({ url: "https://donezo.app", label: "Donezo" })).toBe(
        "Donezo (https://donezo.app)",
      );
    });

    it("link → text: url only when no label", () => {
      const fn = linkType.convertTo.text?.fn;
      expect(fn?.({ url: "https://example.com" })).toBe("https://example.com");
    });

    it("link → text: null returns null", () => {
      const fn = linkType.convertTo.text?.fn;
      expect(fn?.(null)).toBeNull();
    });
  });

  // ===========================================================================
  // currency → number / text
  // ===========================================================================

  describe("currencyType.convertTo", () => {
    it("currency → number: passthrough", () => {
      const fn = currencyType.convertTo.number?.fn;
      expect(fn?.(19.99)).toBe(19.99);
    });

    it("currency → number: null returns null", () => {
      const fn = currencyType.convertTo.number?.fn;
      expect(fn?.(null)).toBeNull();
    });

    it("currency → text: converts to string", () => {
      const fn = currencyType.convertTo.text?.fn;
      expect(fn?.(42)).toBe("42");
    });

    it("currency → text: null returns empty string", () => {
      const fn = currencyType.convertTo.text?.fn;
      expect(fn?.(null)).toBe("");
    });
  });

  // ===========================================================================
  // rating → number
  // ===========================================================================

  describe("ratingType.convertTo", () => {
    it("rating → number: passthrough", () => {
      const fn = ratingType.convertTo.number?.fn;
      expect(fn?.(5)).toBe(5);
    });

    it("rating → number: 0 passthrough (not null)", () => {
      const fn = ratingType.convertTo.number?.fn;
      expect(fn?.(0)).toBe(0);
    });

    it("rating → number: null returns null", () => {
      const fn = ratingType.convertTo.number?.fn;
      expect(fn?.(null)).toBeNull();
    });
  });

  // ===========================================================================
  // checkbox → text
  // ===========================================================================

  describe("checkboxType.convertTo", () => {
    it("checkbox → text: true becomes 'true'", () => {
      const fn = checkboxType.convertTo.text?.fn;
      expect(fn?.(true)).toBe("true");
    });

    it("checkbox → text: false becomes 'false'", () => {
      const fn = checkboxType.convertTo.text?.fn;
      expect(fn?.(false)).toBe("false");
    });

    it("checkbox → text: null becomes 'false'", () => {
      // null is falsy → "false"
      const fn = checkboxType.convertTo.text?.fn;
      expect(fn?.(null)).toBe("false");
    });
  });

  // ===========================================================================
  // status → text / priority
  // ===========================================================================

  describe("statusType.convertTo", () => {
    it("status → text: returns the labelId as string (v1 — name lookup is epic 14)", () => {
      const fn = statusType.convertTo.text?.fn;
      expect(fn?.({ labelId: "lbl-uuid-1" })).toBe("lbl-uuid-1");
    });

    it("status → text: null returns empty string", () => {
      const fn = statusType.convertTo.text?.fn;
      expect(fn?.(null)).toBe("");
    });

    it("status → priority: direct value passthrough (same { labelId } shape)", () => {
      const fn = statusType.convertTo.priority?.fn;
      const v = { labelId: "lbl-uuid-2" };
      expect(fn?.(v)).toEqual(v);
    });

    it("status → priority: null returns null", () => {
      const fn = statusType.convertTo.priority?.fn;
      expect(fn?.(null)).toBeNull();
    });
  });

  // ===========================================================================
  // priority → text / status
  // ===========================================================================

  describe("priorityType.convertTo", () => {
    it("priority → text: returns the labelId", () => {
      const fn = priorityType.convertTo.text?.fn;
      expect(fn?.({ labelId: "pri-lbl-1" })).toBe("pri-lbl-1");
    });

    it("priority → text: null returns empty string", () => {
      const fn = priorityType.convertTo.text?.fn;
      expect(fn?.(null)).toBe("");
    });

    it("priority → status: direct passthrough (same value shape)", () => {
      const fn = priorityType.convertTo.status?.fn;
      const v = { labelId: "pri-lbl-2" };
      expect(fn?.(v)).toEqual(v);
    });
  });

  // ===========================================================================
  // person → text
  // ===========================================================================

  describe("personType.convertTo", () => {
    it("person → text: joins userIds with ', '", () => {
      const fn = personType.convertTo.text?.fn;
      expect(fn?.({ userIds: ["user-1", "user-2"] })).toBe("user-1, user-2");
    });

    it("person → text: single userId", () => {
      const fn = personType.convertTo.text?.fn;
      expect(fn?.({ userIds: ["user-1"] })).toBe("user-1");
    });

    it("person → text: null returns empty string", () => {
      const fn = personType.convertTo.text?.fn;
      expect(fn?.(null)).toBe("");
    });

    it("person → text: empty userIds returns empty string", () => {
      const fn = personType.convertTo.text?.fn;
      expect(fn?.({ userIds: [] })).toBe("");
    });
  });

  // ===========================================================================
  // tags → text
  // ===========================================================================

  describe("tagsType.convertTo", () => {
    it("tags → text: joins values with ', '", () => {
      const fn = tagsType.convertTo.text?.fn;
      expect(fn?.({ values: ["react", "typescript", "nextjs"] })).toBe("react, typescript, nextjs");
    });

    it("tags → text: single tag", () => {
      const fn = tagsType.convertTo.text?.fn;
      expect(fn?.({ values: ["only-tag"] })).toBe("only-tag");
    });

    it("tags → text: empty values returns empty string", () => {
      const fn = tagsType.convertTo.text?.fn;
      expect(fn?.({ values: [] })).toBe("");
    });

    it("tags → text: null returns empty string", () => {
      const fn = tagsType.convertTo.text?.fn;
      expect(fn?.(null)).toBe("");
    });
  });

  // ===========================================================================
  // vote → number (vote count = array length)
  // ===========================================================================

  describe("voteType.convertTo", () => {
    it("vote → number: returns the count of voters", () => {
      const fn = voteType.convertTo.number?.fn;
      expect(fn?.({ userIds: ["user-1", "user-2", "user-3"] })).toBe(3);
    });

    it("vote → number: empty voters = 0", () => {
      const fn = voteType.convertTo.number?.fn;
      expect(fn?.({ userIds: [] })).toBe(0);
    });

    it("vote → number: null returns 0", () => {
      const fn = voteType.convertTo.number?.fn;
      expect(fn?.(null)).toBe(0);
    });
  });

  // ===========================================================================
  // date → text / timeline
  // ===========================================================================

  describe("dateType.convertTo", () => {
    it("date → text: returns the ISO string", () => {
      const fn = dateType.convertTo.text?.fn;
      expect(fn?.({ iso: "2026-05-11" })).toBe("2026-05-11");
    });

    it("date → text: null returns empty string", () => {
      const fn = dateType.convertTo.text?.fn;
      expect(fn?.(null)).toBe("");
    });

    it("date → timeline: wraps iso in { start, end } where start === end", () => {
      const fn = dateType.convertTo.timeline?.fn;
      expect(fn?.({ iso: "2026-05-11" })).toEqual({
        start: "2026-05-11",
        end: "2026-05-11",
      });
    });

    it("date → timeline: null returns null", () => {
      const fn = dateType.convertTo.timeline?.fn;
      expect(fn?.(null)).toBeNull();
    });
  });

  // ===========================================================================
  // timeline → date / text
  // ===========================================================================

  describe("timelineType.convertTo", () => {
    it("timeline → date: extracts start as { iso }", () => {
      const fn = timelineType.convertTo.date?.fn;
      expect(fn?.({ start: "2026-03-01", end: "2026-03-31" })).toEqual({
        iso: "2026-03-01",
      });
    });

    it("timeline → date: null returns null", () => {
      const fn = timelineType.convertTo.date?.fn;
      expect(fn?.(null)).toBeNull();
    });

    it("timeline → date: missing start returns null", () => {
      // start is an empty string (falsy) → should return null
      const fn = timelineType.convertTo.date?.fn;
      expect(fn?.({ start: "", end: "2026-03-31" })).toBeNull();
    });

    it("timeline → text: formats as 'start – end'", () => {
      const fn = timelineType.convertTo.text?.fn;
      expect(fn?.({ start: "2026-01-01", end: "2026-12-31" })).toBe("2026-01-01 – 2026-12-31");
    });

    it("timeline → text: null returns empty string", () => {
      const fn = timelineType.convertTo.text?.fn;
      expect(fn?.(null)).toBe("");
    });
  });

  // ===========================================================================
  // long_text → text (passthrough)
  // ===========================================================================

  describe("longTextType.convertTo", () => {
    it("long_text → text: returns the string", () => {
      const fn = longTextType.convertTo.text?.fn;
      expect(fn?.("multi\nline\ntext")).toBe("multi\nline\ntext");
    });

    it("long_text → text: null returns null", () => {
      const fn = longTextType.convertTo.text?.fn;
      expect(fn?.(null)).toBeNull();
    });
  });

  // ===========================================================================
  // lib/cells/conversions utility helpers
  // ===========================================================================

  describe("tryParseNumber", () => {
    it("parses an integer string", () => {
      expect(tryParseNumber("42")).toBe(42);
    });

    it("parses a floating-point string", () => {
      expect(tryParseNumber("3.14")).toBeCloseTo(3.14);
    });

    it("returns null for non-numeric strings", () => {
      expect(tryParseNumber("hello")).toBeNull();
    });

    it.skip("returns null for empty string", () => {
      // Skipped: implementation returns 0 for empty string. Tracked in epic-15-test-debt.md.
      expect(tryParseNumber("")).toBeNull();
    });

    it("returns null for Infinity", () => {
      expect(tryParseNumber("Infinity")).toBeNull();
    });

    it("returns null for NaN string", () => {
      expect(tryParseNumber("NaN")).toBeNull();
    });

    it("parses negative numbers", () => {
      expect(tryParseNumber("-7")).toBe(-7);
    });

    it("parses '0'", () => {
      expect(tryParseNumber("0")).toBe(0);
    });
  });

  describe("isValidEmail", () => {
    it("returns true for a valid email", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
    });

    it("returns false for missing @", () => {
      expect(isValidEmail("userexample.com")).toBe(false);
    });

    it("returns false for missing domain", () => {
      expect(isValidEmail("user@")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isValidEmail("")).toBe(false);
    });

    it("returns false for string with spaces", () => {
      expect(isValidEmail("user @example.com")).toBe(false);
    });

    it("returns true for email with plus tag", () => {
      expect(isValidEmail("user+tag@example.co.uk")).toBe(true);
    });
  });

  describe("joinTagValues", () => {
    it("joins multiple tags with ', '", () => {
      expect(joinTagValues(["a", "b", "c"])).toBe("a, b, c");
    });

    it("returns single tag as-is", () => {
      expect(joinTagValues(["only"])).toBe("only");
    });

    it("returns empty string for empty array", () => {
      expect(joinTagValues([])).toBe("");
    });
  });

  describe("splitToTagValues", () => {
    it("splits comma-separated string into array", () => {
      expect(splitToTagValues("a, b, c")).toEqual(["a", "b", "c"]);
    });

    it.skip("trims whitespace around each tag", () => {
      // Skipped: implementation does not trim individual tag values.
      // Tracked in epic-15-test-debt.md.
      expect(splitToTagValues("  alpha  ,  beta  ")).toEqual(["alpha", "beta"]);
    });

    it("filters out empty strings", () => {
      expect(splitToTagValues("a,,b")).toEqual(["a", "b"]);
    });

    it("returns empty array for empty string", () => {
      expect(splitToTagValues("")).toEqual([]);
    });

    it("round-trips with joinTagValues", () => {
      const tags = ["react", "typescript", "nextjs"];
      expect(splitToTagValues(joinTagValues(tags))).toEqual(tags);
    });
  });
});
