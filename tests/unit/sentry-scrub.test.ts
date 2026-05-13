import type { ErrorEvent, EventHint } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { scrubUserPII } from "../../lib/sentry/scrub";

// A minimal no-op hint used wherever the function signature requires one.
const noHint = {} as EventHint;

describe("scrubUserPII", () => {
  it("removes email and name from event.user, keeps id", () => {
    const event: ErrorEvent = {
      exception: {},
      user: {
        id: "user-123",
        email: "alice@example.com",
        username: "alice",
      },
    };
    const result = scrubUserPII(event, noHint);
    expect(result.user).toEqual({ id: "user-123" });
    expect(result.user).not.toHaveProperty("email");
    expect(result.user).not.toHaveProperty("username");
  });

  it("collapses user to empty object when no id was set", () => {
    const event: ErrorEvent = {
      exception: {},
      user: {
        email: "bob@example.com",
        username: "bob",
      },
    };
    const result = scrubUserPII(event, noHint);
    // id is undefined so scrub produces {}
    expect(result.user).toEqual({});
  });

  it("returns event unchanged when user context is absent", () => {
    const event: ErrorEvent = { exception: {}, message: "no user context" };
    const result = scrubUserPII(event, noHint);
    expect(result.user).toBeUndefined();
    expect(result.message).toBe("no user context");
  });

  it("returns event unchanged when user is empty object", () => {
    const event: ErrorEvent = { exception: {}, user: {} };
    const result = scrubUserPII(event, noHint);
    expect(result.user).toEqual({});
  });

  it("preserves other event fields", () => {
    const event: ErrorEvent = {
      exception: {},
      message: "something happened",
      user: { id: "user-456", email: "carol@example.com" },
    };
    const result = scrubUserPII(event, noHint);
    expect(result.message).toBe("something happened");
    expect(result.user).toEqual({ id: "user-456" });
  });
});
