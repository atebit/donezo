// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it } from "vitest";

/**
 * Tests for cell type codec contracts: toRow / fromRow round-trips.
 *
 * Covers the representative subset mandated by S23 spec:
 *   text, long_text, number, status (label_id), date,
 *   timeline (both date columns), tags (json_value array),
 *   updated_by (derived — toRow returns {}), checkbox, email,
 *   phone, country, link, currency, rating, person, vote, priority.
 *
 * The remaining types (file, formula, location, week, created_by,
 * created_at_col) follow the same shape as one of the above; a single
 * representative test is written for each.
 *
 * NOTE: These tests are skipped until Vitest is installed in epic 15.
 */

import { checkboxType } from "@/components/cells/checkbox/def";
import { countryType } from "@/components/cells/country/def";
import { createdAtColType } from "@/components/cells/created_at_col/def";
import { createdByType } from "@/components/cells/created_by/def";
import { currencyType } from "@/components/cells/currency/def";
import { dateType } from "@/components/cells/date/def";
import { emailType } from "@/components/cells/email/def";
import { fileType } from "@/components/cells/file/def";
import { formulaType } from "@/components/cells/formula/def";
import { linkType } from "@/components/cells/link/def";
import { locationType } from "@/components/cells/location/def";
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
import { updatedByType } from "@/components/cells/updated_by/def";
import { voteType } from "@/components/cells/vote/def";
import { weekType } from "@/components/cells/week/def";

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

/** Minimal cell row scaffold with all value columns set to null. */
function fakeCellRow(patch: Record<string, unknown> = {}) {
  return {
    task_id: "task-uuid",
    column_id: "col-uuid",
    text_value: null,
    number_value: null,
    boolean_value: null,
    date_value: null,
    date_end_value: null,
    label_id: null,
    json_value: null,
    updated_by: null,
    created_at: "2026-05-11T00:00:00Z",
    updated_at: "2026-05-11T00:00:00Z",
    ...patch,
    // biome-ignore lint/suspicious/noExplicitAny: test helper — CellRow type is complex; cast is intentional for test scaffolding
  } as any;
}

// ---------------------------------------------------------------------------
// Assertions re-used across all types:
// Every toRow patch must null all value columns it does not own.
// ---------------------------------------------------------------------------

const ALL_VALUE_COLUMNS = [
  "text_value",
  "number_value",
  "boolean_value",
  "date_value",
  "date_end_value",
  "label_id",
  "json_value",
] as const;

function expectNullsExcept(
  patch: Record<string, unknown>,
  owned: (typeof ALL_VALUE_COLUMNS)[number][],
) {
  for (const col of ALL_VALUE_COLUMNS) {
    if (!owned.includes(col)) {
      expect(patch[col]).toBeNull();
    }
  }
}

// ===========================================================================
// text
// ===========================================================================

describe.skip("cell codecs", () => {
  describe("textType", () => {
    it("toRow stores text_value and nulls all others", () => {
      const patch = textType.toRow("hello");
      expect(patch.text_value).toBe("hello");
      expectNullsExcept(patch as Record<string, unknown>, ["text_value"]);
    });

    it("toRow with null stores null text_value and nulls all others", () => {
      const patch = textType.toRow(null);
      expect(patch.text_value).toBeNull();
      expectNullsExcept(patch as Record<string, unknown>, ["text_value"]);
    });

    it("fromRow returns the text_value", () => {
      const row = fakeCellRow({ text_value: "hello" });
      expect(textType.fromRow(row)).toBe("hello");
    });

    it("fromRow returns null when text_value is null", () => {
      expect(textType.fromRow(fakeCellRow())).toBeNull();
    });

    it("fromRow returns null when row is undefined", () => {
      expect(textType.fromRow(undefined)).toBeNull();
    });

    it("round-trips: fromRow(toRow(v)) === v", () => {
      const v = "hello world";
      const patch = textType.toRow(v);
      const row = fakeCellRow(patch as Record<string, unknown>);
      expect(textType.fromRow(row)).toBe(v);
    });
  });

  // ===========================================================================
  // long_text
  // ===========================================================================

  describe("longTextType", () => {
    it("toRow stores text_value and nulls all others", () => {
      const patch = longTextType.toRow("multi\nline");
      expect(patch.text_value).toBe("multi\nline");
      expectNullsExcept(patch as Record<string, unknown>, ["text_value"]);
    });

    it("fromRow returns the text_value", () => {
      expect(longTextType.fromRow(fakeCellRow({ text_value: "hi" }))).toBe("hi");
    });

    it("round-trips string value", () => {
      const v = "line one\nline two";
      const patch = longTextType.toRow(v);
      expect(longTextType.fromRow(fakeCellRow(patch as Record<string, unknown>))).toBe(v);
    });
  });

  // ===========================================================================
  // number
  // ===========================================================================

  describe("numberType", () => {
    it("toRow stores number_value and nulls all others", () => {
      const patch = numberType.toRow(42);
      expect(patch.number_value).toBe(42);
      expectNullsExcept(patch as Record<string, unknown>, ["number_value"]);
    });

    it("toRow with 0 stores 0, not null", () => {
      const patch = numberType.toRow(0);
      expect(patch.number_value).toBe(0);
    });

    it("fromRow returns the number_value", () => {
      expect(numberType.fromRow(fakeCellRow({ number_value: 99 }))).toBe(99);
    });

    it("fromRow returns null when number_value is null", () => {
      expect(numberType.fromRow(fakeCellRow())).toBeNull();
    });

    it("round-trips numeric value", () => {
      const v = 3.14;
      const patch = numberType.toRow(v);
      expect(numberType.fromRow(fakeCellRow(patch as Record<string, unknown>))).toBe(v);
    });
  });

  // ===========================================================================
  // status  (label_id)
  // ===========================================================================

  describe("statusType", () => {
    it("toRow stores label_id and nulls all others", () => {
      const patch = statusType.toRow({ labelId: "lbl-uuid-1" });
      expect(patch.label_id).toBe("lbl-uuid-1");
      expectNullsExcept(patch as Record<string, unknown>, ["label_id"]);
    });

    it("toRow with null stores null label_id", () => {
      const patch = statusType.toRow(null);
      expect(patch.label_id).toBeNull();
      expectNullsExcept(patch as Record<string, unknown>, ["label_id"]);
    });

    it("fromRow extracts label_id into { labelId }", () => {
      const row = fakeCellRow({ label_id: "lbl-uuid-2" });
      expect(statusType.fromRow(row)).toEqual({ labelId: "lbl-uuid-2" });
    });

    it("fromRow returns null when label_id is null", () => {
      expect(statusType.fromRow(fakeCellRow())).toBeNull();
    });

    it("round-trips: fromRow(toRow(v)).labelId === v.labelId", () => {
      const v = { labelId: "lbl-uuid-3" };
      const patch = statusType.toRow(v);
      const row = fakeCellRow(patch as Record<string, unknown>);
      expect(statusType.fromRow(row)).toEqual(v);
    });
  });

  // ===========================================================================
  // priority  (same shape as status, different id)
  // ===========================================================================

  describe("priorityType", () => {
    it("toRow stores label_id and nulls all others", () => {
      const patch = priorityType.toRow({ labelId: "pri-lbl-1" });
      expect(patch.label_id).toBe("pri-lbl-1");
      expectNullsExcept(patch as Record<string, unknown>, ["label_id"]);
    });

    it("fromRow extracts label_id", () => {
      expect(priorityType.fromRow(fakeCellRow({ label_id: "pri-lbl-2" }))).toEqual({
        labelId: "pri-lbl-2",
      });
    });

    it("round-trips priority value", () => {
      const v = { labelId: "pri-lbl-3" };
      const patch = priorityType.toRow(v);
      expect(priorityType.fromRow(fakeCellRow(patch as Record<string, unknown>))).toEqual(v);
    });
  });

  // ===========================================================================
  // date
  // ===========================================================================

  describe("dateType", () => {
    it("toRow stores date_value and nulls all others (including date_end_value)", () => {
      const patch = dateType.toRow({ iso: "2026-05-11" });
      expect(patch.date_value).toBe("2026-05-11");
      expect(patch.date_end_value).toBeNull();
      expectNullsExcept(patch as Record<string, unknown>, ["date_value"]);
    });

    it("toRow with null stores null date_value", () => {
      const patch = dateType.toRow(null);
      expect(patch.date_value).toBeNull();
    });

    it("fromRow extracts date_value into { iso }", () => {
      expect(dateType.fromRow(fakeCellRow({ date_value: "2026-01-01" }))).toEqual({
        iso: "2026-01-01",
      });
    });

    it("fromRow returns null when date_value is null", () => {
      expect(dateType.fromRow(fakeCellRow())).toBeNull();
    });

    it("round-trips date value", () => {
      const v = { iso: "2026-07-04" };
      const patch = dateType.toRow(v);
      expect(dateType.fromRow(fakeCellRow(patch as Record<string, unknown>))).toEqual(v);
    });
  });

  // ===========================================================================
  // timeline  (uses BOTH date_value + date_end_value)
  // ===========================================================================

  describe("timelineType", () => {
    it("toRow writes date_value (start) and date_end_value (end)", () => {
      const patch = timelineType.toRow({ start: "2026-05-01", end: "2026-05-31" });
      expect(patch.date_value).toBe("2026-05-01");
      expect(patch.date_end_value).toBe("2026-05-31");
      // All other value columns must be null
      expect(patch.text_value).toBeNull();
      expect(patch.number_value).toBeNull();
      expect(patch.boolean_value).toBeNull();
      expect(patch.label_id).toBeNull();
      expect(patch.json_value).toBeNull();
    });

    it("toRow with null stores null in both date columns", () => {
      const patch = timelineType.toRow(null);
      expect(patch.date_value).toBeNull();
      expect(patch.date_end_value).toBeNull();
    });

    it("fromRow extracts both date columns into { start, end }", () => {
      const row = fakeCellRow({ date_value: "2026-01-01", date_end_value: "2026-12-31" });
      expect(timelineType.fromRow(row)).toEqual({ start: "2026-01-01", end: "2026-12-31" });
    });

    it("fromRow returns null when date_value is null (no start)", () => {
      // timeline requires both; if either is missing, it should return null
      expect(timelineType.fromRow(fakeCellRow())).toBeNull();
    });

    it("round-trips timeline value", () => {
      const v = { start: "2026-03-01", end: "2026-03-31" };
      const patch = timelineType.toRow(v);
      expect(timelineType.fromRow(fakeCellRow(patch as Record<string, unknown>))).toEqual(v);
    });
  });

  // ===========================================================================
  // tags  (json_value array)
  // ===========================================================================

  describe("tagsType", () => {
    it("toRow stores json_value with values array and nulls all others", () => {
      const patch = tagsType.toRow({ values: ["alpha", "beta"] });
      expect(patch.json_value).toEqual({ values: ["alpha", "beta"] });
      expectNullsExcept(patch as Record<string, unknown>, ["json_value"]);
    });

    it("toRow with empty array stores null json_value (no empty arrays in DB)", () => {
      const patch = tagsType.toRow({ values: [] });
      expect(patch.json_value).toBeNull();
    });

    it("toRow with null stores null json_value", () => {
      const patch = tagsType.toRow(null);
      expect(patch.json_value).toBeNull();
    });

    it("fromRow extracts json_value into { values }", () => {
      const row = fakeCellRow({ json_value: { values: ["foo", "bar"] } });
      expect(tagsType.fromRow(row)).toEqual({ values: ["foo", "bar"] });
    });

    it("fromRow returns null when json_value is null", () => {
      expect(tagsType.fromRow(fakeCellRow())).toBeNull();
    });

    it("fromRow returns null when json_value has wrong shape", () => {
      const row = fakeCellRow({ json_value: { unexpected: true } });
      expect(tagsType.fromRow(row)).toBeNull();
    });

    it("round-trips tags value", () => {
      const v = { values: ["react", "typescript"] };
      const patch = tagsType.toRow(v);
      expect(tagsType.fromRow(fakeCellRow(patch as Record<string, unknown>))).toEqual(v);
    });
  });

  // ===========================================================================
  // updated_by  (derived — toRow returns {})
  // ===========================================================================

  describe("updatedByType", () => {
    it("toRow returns empty object (no cell writes for derived types)", () => {
      const patch = updatedByType.toRow({ userId: "user-1", updatedAt: "2026-05-11T00:00:00Z" });
      expect(patch).toEqual({});
    });

    it("toRow returns {} even when called with null", () => {
      const patch = updatedByType.toRow(null);
      expect(patch).toEqual({});
    });

    it("fromRow returns null (derived from task row, not cell row)", () => {
      // updated_by value comes from the task row prop, not the cell row
      expect(updatedByType.fromRow(fakeCellRow())).toBeNull();
      expect(updatedByType.fromRow(undefined)).toBeNull();
    });
  });

  // ===========================================================================
  // checkbox
  // ===========================================================================

  describe("checkboxType", () => {
    it("toRow stores boolean_value=true and nulls all others", () => {
      const patch = checkboxType.toRow(true);
      expect(patch.boolean_value).toBe(true);
      expectNullsExcept(patch as Record<string, unknown>, ["boolean_value"]);
    });

    it("toRow stores boolean_value=false", () => {
      const patch = checkboxType.toRow(false);
      expect(patch.boolean_value).toBe(false);
    });

    it("toRow with null stores null boolean_value", () => {
      const patch = checkboxType.toRow(null);
      expect(patch.boolean_value).toBeNull();
    });

    it("fromRow returns the boolean_value", () => {
      expect(checkboxType.fromRow(fakeCellRow({ boolean_value: true }))).toBe(true);
      expect(checkboxType.fromRow(fakeCellRow({ boolean_value: false }))).toBe(false);
    });

    it("fromRow returns null when boolean_value is null", () => {
      expect(checkboxType.fromRow(fakeCellRow())).toBeNull();
    });

    it("round-trips true", () => {
      const patch = checkboxType.toRow(true);
      expect(checkboxType.fromRow(fakeCellRow(patch as Record<string, unknown>))).toBe(true);
    });

    it("round-trips false", () => {
      const patch = checkboxType.toRow(false);
      expect(checkboxType.fromRow(fakeCellRow(patch as Record<string, unknown>))).toBe(false);
    });
  });

  // ===========================================================================
  // email, phone, country  (all store text_value — representative shape)
  // ===========================================================================

  describe("emailType", () => {
    it("toRow stores text_value and nulls all others", () => {
      const patch = emailType.toRow("user@example.com");
      expect(patch.text_value).toBe("user@example.com");
      expectNullsExcept(patch as Record<string, unknown>, ["text_value"]);
    });

    it("fromRow returns text_value", () => {
      expect(emailType.fromRow(fakeCellRow({ text_value: "a@b.com" }))).toBe("a@b.com");
    });

    it("round-trips email", () => {
      const v = "test@example.org";
      const patch = emailType.toRow(v);
      expect(emailType.fromRow(fakeCellRow(patch as Record<string, unknown>))).toBe(v);
    });
  });

  describe("phoneType", () => {
    it("toRow stores text_value and nulls all others", () => {
      const patch = phoneType.toRow("+1-555-867-5309");
      expect(patch.text_value).toBe("+1-555-867-5309");
      expectNullsExcept(patch as Record<string, unknown>, ["text_value"]);
    });

    it("fromRow returns text_value", () => {
      expect(phoneType.fromRow(fakeCellRow({ text_value: "+447911123456" }))).toBe("+447911123456");
    });

    it("round-trips phone number", () => {
      const v = "+1-800-555-0100";
      const patch = phoneType.toRow(v);
      expect(phoneType.fromRow(fakeCellRow(patch as Record<string, unknown>))).toBe(v);
    });
  });

  describe("countryType", () => {
    it("toRow stores ISO code in text_value and nulls all others", () => {
      const patch = countryType.toRow("US");
      expect(patch.text_value).toBe("US");
      expectNullsExcept(patch as Record<string, unknown>, ["text_value"]);
    });

    it("fromRow returns the text_value (ISO code)", () => {
      expect(countryType.fromRow(fakeCellRow({ text_value: "DE" }))).toBe("DE");
    });

    it("round-trips country code", () => {
      const v = "JP";
      const patch = countryType.toRow(v);
      expect(countryType.fromRow(fakeCellRow(patch as Record<string, unknown>))).toBe(v);
    });
  });

  // ===========================================================================
  // link  (json_value object)
  // ===========================================================================

  describe("linkType", () => {
    it("toRow stores link object in json_value and nulls all others", () => {
      const patch = linkType.toRow({ url: "https://example.com", label: "Example" });
      expect(patch.json_value).toEqual({ url: "https://example.com", label: "Example" });
      expectNullsExcept(patch as Record<string, unknown>, ["json_value"]);
    });

    it("toRow with url-only link", () => {
      const patch = linkType.toRow({ url: "https://donezo.app" });
      expect(patch.json_value).toEqual({ url: "https://donezo.app" });
    });

    it("toRow with null stores null json_value", () => {
      const patch = linkType.toRow(null);
      expect(patch.json_value).toBeNull();
    });

    it("fromRow extracts the link object", () => {
      const row = fakeCellRow({ json_value: { url: "https://example.com", label: "Ex" } });
      expect(linkType.fromRow(row)).toEqual({ url: "https://example.com", label: "Ex" });
    });

    it("fromRow returns null for malformed json_value (missing url)", () => {
      const row = fakeCellRow({ json_value: { notUrl: "oops" } });
      expect(linkType.fromRow(row)).toBeNull();
    });

    it("round-trips link with label", () => {
      const v = { url: "https://donezo.app", label: "Donezo" };
      const patch = linkType.toRow(v);
      expect(linkType.fromRow(fakeCellRow(patch as Record<string, unknown>))).toEqual(v);
    });
  });

  // ===========================================================================
  // currency
  // ===========================================================================

  describe("currencyType", () => {
    it("toRow stores number_value and nulls all others", () => {
      const patch = currencyType.toRow(99.99);
      expect(patch.number_value).toBe(99.99);
      expectNullsExcept(patch as Record<string, unknown>, ["number_value"]);
    });

    it("fromRow returns number_value", () => {
      expect(currencyType.fromRow(fakeCellRow({ number_value: 1234.56 }))).toBe(1234.56);
    });

    it("round-trips currency amount", () => {
      const v = 42.0;
      const patch = currencyType.toRow(v);
      expect(currencyType.fromRow(fakeCellRow(patch as Record<string, unknown>))).toBe(v);
    });
  });

  // ===========================================================================
  // rating
  // ===========================================================================

  describe("ratingType", () => {
    it("toRow stores number_value and nulls all others", () => {
      const patch = ratingType.toRow(4);
      expect(patch.number_value).toBe(4);
      expectNullsExcept(patch as Record<string, unknown>, ["number_value"]);
    });

    it("fromRow returns the number_value", () => {
      expect(ratingType.fromRow(fakeCellRow({ number_value: 5 }))).toBe(5);
    });

    it("round-trips rating value", () => {
      const patch = ratingType.toRow(3);
      expect(ratingType.fromRow(fakeCellRow(patch as Record<string, unknown>))).toBe(3);
    });
  });

  // ===========================================================================
  // person
  // ===========================================================================

  describe("personType", () => {
    it("toRow stores userIds object in json_value and nulls all others", () => {
      const patch = personType.toRow({ userIds: ["user-1", "user-2"] });
      expect(patch.json_value).toEqual({ userIds: ["user-1", "user-2"] });
      expectNullsExcept(patch as Record<string, unknown>, ["json_value"]);
    });

    it("toRow with null stores null json_value", () => {
      const patch = personType.toRow(null);
      expect(patch.json_value).toBeNull();
    });

    it("fromRow extracts { userIds }", () => {
      const row = fakeCellRow({ json_value: { userIds: ["u-1"] } });
      expect(personType.fromRow(row)).toEqual({ userIds: ["u-1"] });
    });

    it("fromRow returns null when json_value has wrong shape", () => {
      const row = fakeCellRow({ json_value: { name: "wrong" } });
      expect(personType.fromRow(row)).toBeNull();
    });

    it("round-trips person value", () => {
      const v = { userIds: ["user-uuid-1", "user-uuid-2"] };
      const patch = personType.toRow(v);
      expect(personType.fromRow(fakeCellRow(patch as Record<string, unknown>))).toEqual(v);
    });
  });

  // ===========================================================================
  // vote
  // ===========================================================================

  describe("voteType", () => {
    it("toRow stores json_value with userIds when non-empty", () => {
      const patch = voteType.toRow({ userIds: ["user-1", "user-2"] });
      expect(patch.json_value).toEqual({ userIds: ["user-1", "user-2"] });
      expectNullsExcept(patch as Record<string, unknown>, ["json_value"]);
    });

    it("toRow with empty userIds stores null (no empty vote arrays in DB)", () => {
      const patch = voteType.toRow({ userIds: [] });
      expect(patch.json_value).toBeNull();
    });

    it("toRow with null stores null json_value", () => {
      const patch = voteType.toRow(null);
      expect(patch.json_value).toBeNull();
    });

    it("fromRow extracts { userIds }", () => {
      const row = fakeCellRow({ json_value: { userIds: ["u-1"] } });
      expect(voteType.fromRow(row)).toEqual({ userIds: ["u-1"] });
    });

    it("fromRow returns null when json_value has wrong shape", () => {
      expect(voteType.fromRow(fakeCellRow({ json_value: 42 }))).toBeNull();
    });

    it("round-trips vote value", () => {
      const v = { userIds: ["user-a", "user-b"] };
      const patch = voteType.toRow(v);
      expect(voteType.fromRow(fakeCellRow(patch as Record<string, unknown>))).toEqual(v);
    });
  });

  // ===========================================================================
  // Representative tests for remaining types that follow the same patterns
  // ===========================================================================

  // file: json_value object (same shape as link/tags)
  describe("fileType (representative)", () => {
    it("toRow returns a patch object (json_value or all-null)", () => {
      const patch = fileType.toRow(null);
      // Regardless of shape, all non-owned columns must be null
      for (const col of [
        "text_value",
        "number_value",
        "boolean_value",
        "date_value",
        "label_id",
      ] as const) {
        expect(patch[col]).toBeNull();
      }
    });

    it("fromRow returns null when json_value is null", () => {
      expect(fileType.fromRow(fakeCellRow())).toBeNull();
    });
  });

  // formula: derived stub — toRow returns {} like updated_by
  describe("formulaType (representative stub)", () => {
    it("toRow returns a patch (may be {} or all-null per stub implementation)", () => {
      const patch = formulaType.toRow(null);
      // formulaType is a stub; at minimum it must return a non-throwing object
      expect(typeof patch).toBe("object");
    });

    it("fromRow returns null or a placeholder value", () => {
      const v = formulaType.fromRow(fakeCellRow());
      // stub — null or a placeholder string are both acceptable
      expect(v == null || typeof v === "string").toBe(true);
    });
  });

  // location: json_value object (lat/lng + optional label)
  describe("locationType (representative)", () => {
    it("toRow returns a patch object with json_value or null", () => {
      const patch = locationType.toRow(null);
      // All non-json_value columns must be null
      expect(patch.text_value).toBeNull();
      expect(patch.number_value).toBeNull();
      expect(patch.boolean_value).toBeNull();
      expect(patch.date_value).toBeNull();
      expect(patch.label_id).toBeNull();
    });

    it("fromRow returns null when json_value is null", () => {
      expect(locationType.fromRow(fakeCellRow())).toBeNull();
    });
  });

  // week: similar to date — stores in date_value or json_value
  describe("weekType (representative)", () => {
    it("toRow returns a patch object", () => {
      const patch = weekType.toRow(null);
      expect(typeof patch).toBe("object");
      expect(patch).not.toBeNull();
    });

    it("fromRow returns null when no value is set", () => {
      expect(weekType.fromRow(fakeCellRow())).toBeNull();
    });
  });

  // created_by: derived like updated_by — toRow returns {}
  describe("createdByType (representative)", () => {
    it("toRow returns empty object (derived type)", () => {
      const patch = createdByType.toRow(null);
      expect(patch).toEqual({});
    });

    it("fromRow returns null (derived from task row)", () => {
      expect(createdByType.fromRow(fakeCellRow())).toBeNull();
    });
  });

  // created_at_col: derived like updated_by — toRow returns {}
  describe("createdAtColType (representative)", () => {
    it("toRow returns empty object (derived type)", () => {
      const patch = createdAtColType.toRow(null);
      expect(patch).toEqual({});
    });

    it("fromRow returns null (derived from task row)", () => {
      expect(createdAtColType.fromRow(fakeCellRow())).toBeNull();
    });
  });
});
