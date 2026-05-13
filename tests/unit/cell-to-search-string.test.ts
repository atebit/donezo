/**
 * Tests for `toSearchString` on all 24 cell type defs.
 * One assertion per type — verifies the expected text representation.
 */
import { describe, expect, it } from "vitest";
import { checkboxType } from "../../components/cells/checkbox/def";
import { countryType } from "../../components/cells/country/def";
import { createdAtColType } from "../../components/cells/created_at_col/def";
import { createdByType } from "../../components/cells/created_by/def";
import { currencyType } from "../../components/cells/currency/def";
import { dateType } from "../../components/cells/date/def";
import { emailType } from "../../components/cells/email/def";
import { fileType } from "../../components/cells/file/def";
import { formulaType } from "../../components/cells/formula/def";
import { linkType } from "../../components/cells/link/def";
import { locationType } from "../../components/cells/location/def";
import { longTextType } from "../../components/cells/long_text/def";
import { numberType } from "../../components/cells/number/def";
import { personType } from "../../components/cells/person/def";
import { phoneType } from "../../components/cells/phone/def";
import { priorityType } from "../../components/cells/priority/def";
import { ratingType } from "../../components/cells/rating/def";
import { statusType } from "../../components/cells/status/def";
import { tagsType } from "../../components/cells/tags/def";
import { textType } from "../../components/cells/text/def";
import { timelineType } from "../../components/cells/timeline/def";
import { updatedByType } from "../../components/cells/updated_by/def";
import { voteType } from "../../components/cells/vote/def";
import { weekType } from "../../components/cells/week/def";

describe("cell toSearchString", () => {
  // text
  it("text: returns the string value", () => {
    expect(textType.toSearchString("hello world", {})).toBe("hello world");
    expect(textType.toSearchString(null, {})).toBe("");
  });

  // long_text
  it("long_text: returns the string value", () => {
    expect(longTextType.toSearchString("some long text", { richText: false })).toBe(
      "some long text",
    );
    expect(longTextType.toSearchString(null, { richText: false })).toBe("");
  });

  // status — resolves label title from config.labels
  it("status: returns label title from config when labelId matches", () => {
    const config = {
      labels: [
        { id: "lbl-1", title: "Done" },
        { id: "lbl-2", title: "In Progress" },
      ],
    };
    // Cast config to the expected type for the test (runtime duck-typing)
    expect(
      statusType.toSearchString({ labelId: "lbl-1" }, config as unknown as Record<string, never>),
    ).toBe("Done");
    expect(
      statusType.toSearchString({ labelId: "lbl-2" }, config as unknown as Record<string, never>),
    ).toBe("In Progress");
    // Unknown label id → ""
    expect(
      statusType.toSearchString({ labelId: "unknown" }, config as unknown as Record<string, never>),
    ).toBe("");
    // null value → ""
    expect(statusType.toSearchString(null, {} as Record<string, never>)).toBe("");
  });

  // priority — same label pattern
  it("priority: returns label title from config when labelId matches", () => {
    const config = {
      labels: [
        { id: "p-1", title: "Critical" },
        { id: "p-2", title: "Low" },
      ],
    };
    expect(
      priorityType.toSearchString({ labelId: "p-1" }, config as unknown as Record<string, never>),
    ).toBe("Critical");
    expect(priorityType.toSearchString(null, {} as Record<string, never>)).toBe("");
  });

  // person
  it("person: returns '' (v1 fallback)", () => {
    expect(personType.toSearchString({ userIds: ["uid-1", "uid-2"] }, {})).toBe("");
    expect(personType.toSearchString(null, {})).toBe("");
  });

  // date
  it("date: returns ISO string", () => {
    expect(dateType.toSearchString({ iso: "2026-05-15" }, {})).toBe("2026-05-15");
    expect(dateType.toSearchString(null, {})).toBe("");
  });

  // timeline
  it("timeline: returns 'start → end'", () => {
    expect(timelineType.toSearchString({ start: "2026-05-01", end: "2026-05-31" }, {})).toBe(
      "2026-05-01 → 2026-05-31",
    );
    expect(timelineType.toSearchString(null, {})).toBe("");
  });

  // number
  it("number: returns numeric string", () => {
    expect(numberType.toSearchString(42, {})).toBe("42");
    expect(numberType.toSearchString(0, {})).toBe("0");
    expect(numberType.toSearchString(null, {})).toBe("");
  });

  // currency
  it("currency: returns numeric string", () => {
    expect(currencyType.toSearchString(99.99, { currency: "USD" })).toBe("99.99");
    expect(currencyType.toSearchString(null, { currency: "USD" })).toBe("");
  });

  // checkbox
  it("checkbox: returns 'true' or 'false' (lowercase), '' for null", () => {
    expect(checkboxType.toSearchString(true, {})).toBe("true");
    expect(checkboxType.toSearchString(false, {})).toBe("false");
    expect(checkboxType.toSearchString(null, {})).toBe("");
  });

  // file
  it("file: returns '' (v1)", () => {
    expect(fileType.toSearchString({ attachmentIds: ["att-1"] }, {})).toBe("");
    expect(fileType.toSearchString(null, {})).toBe("");
  });

  // link
  it("link: returns label + url joined by space", () => {
    expect(linkType.toSearchString({ url: "https://example.com", label: "Example" }, {})).toBe(
      "Example https://example.com",
    );
    // URL only (no label)
    expect(linkType.toSearchString({ url: "https://example.com" }, {})).toBe("https://example.com");
    expect(linkType.toSearchString(null, {})).toBe("");
  });

  // tags
  it("tags: returns tags joined by space", () => {
    expect(tagsType.toSearchString({ values: ["alpha", "beta", "gamma"] }, {})).toBe(
      "alpha beta gamma",
    );
    expect(tagsType.toSearchString(null, {})).toBe("");
  });

  // rating
  it("rating: returns numeric string", () => {
    expect(ratingType.toSearchString(4, {})).toBe("4");
    expect(ratingType.toSearchString(null, {})).toBe("");
  });

  // email
  it("email: returns the email string", () => {
    expect(emailType.toSearchString("user@example.com", {})).toBe("user@example.com");
    expect(emailType.toSearchString(null, {})).toBe("");
  });

  // phone
  it("phone: returns the phone string", () => {
    expect(phoneType.toSearchString("+1-555-0100", {})).toBe("+1-555-0100");
    expect(phoneType.toSearchString(null, {})).toBe("");
  });

  // country
  it("country: returns the ISO code string", () => {
    expect(countryType.toSearchString("US", {})).toBe("US");
    expect(countryType.toSearchString(null, {})).toBe("");
  });

  // vote
  it("vote: returns '' (v1)", () => {
    expect(voteType.toSearchString({ userIds: ["uid-1"] }, {})).toBe("");
    expect(voteType.toSearchString(null, {})).toBe("");
  });

  // week
  it("week: returns '' (v1)", () => {
    expect(weekType.toSearchString({ year: 2026, week: 20 }, {})).toBe("");
    expect(weekType.toSearchString(null, {})).toBe("");
  });

  // location
  it("location: returns '' (v1)", () => {
    expect(locationType.toSearchString({ lat: 51.5, lng: -0.1, label: "London" }, {})).toBe("");
    expect(locationType.toSearchString(null, {})).toBe("");
  });

  // updated_by
  it("updated_by: returns '' (v1 derived)", () => {
    expect(
      updatedByType.toSearchString({ userId: "uid-1", updatedAt: "2026-05-15T00:00:00Z" }, {}),
    ).toBe("");
    expect(updatedByType.toSearchString(null, {})).toBe("");
  });

  // created_by
  it("created_by: returns '' (v1 derived)", () => {
    expect(
      createdByType.toSearchString({ userId: "uid-1", createdAt: "2026-05-15T00:00:00Z" }, {}),
    ).toBe("");
    expect(createdByType.toSearchString(null, {})).toBe("");
  });

  // created_at_col
  it("created_at_col: returns '' (v1 derived)", () => {
    expect(createdAtColType.toSearchString({ createdAt: "2026-05-15T00:00:00Z" }, {})).toBe("");
    expect(createdAtColType.toSearchString(null, {})).toBe("");
  });

  // formula
  it("formula: returns '' (v1 computed)", () => {
    expect(formulaType.toSearchString(null, {})).toBe("");
  });
});
