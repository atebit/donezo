import { describe, expect, it } from "vitest";
import {
  ForgotPasswordSchema,
  ResetPasswordSchema,
  SignInSchema,
  SignUpSchema,
  UpdateEmailSchema,
  UpdatePasswordSchema,
  UpdateProfileSchema,
} from "../../lib/validations/auth";

/**
 * Tests for lib/validations/auth.ts — Zod auth schema validation.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * They are written here so the epic 15 executor can pick them up without changes.
 */

describe("SignInSchema", () => {
  it("rejects missing email", () => {
    expect(SignInSchema.safeParse({ email: "not-an-email", password: "secret" }).success).toBe(
      false,
    );
  });

  it("accepts valid credentials", () => {
    expect(
      SignInSchema.safeParse({ email: "user@example.com", password: "anypassword" }).success,
    ).toBe(true);
  });
});

describe("SignUpSchema", () => {
  it("rejects a password shorter than 10 characters", () => {
    expect(
      SignUpSchema.safeParse({
        email: "user@example.com",
        password: "short",
        displayName: "Alice",
      }).success,
    ).toBe(false);
  });

  it("accepts valid sign-up data", () => {
    expect(
      SignUpSchema.safeParse({
        email: "user@example.com",
        password: "longpassword1",
        displayName: "Alice",
      }).success,
    ).toBe(true);
  });
});

describe("ForgotPasswordSchema", () => {
  it("rejects an invalid email", () => {
    expect(ForgotPasswordSchema.safeParse({ email: "not-valid" }).success).toBe(false);
  });

  it("accepts a valid email", () => {
    expect(ForgotPasswordSchema.safeParse({ email: "user@example.com" }).success).toBe(true);
  });
});

describe("ResetPasswordSchema", () => {
  it("rejects a password shorter than 10 characters", () => {
    expect(ResetPasswordSchema.safeParse({ password: "tooshort" }).success).toBe(false);
  });

  it("accepts a valid password", () => {
    expect(ResetPasswordSchema.safeParse({ password: "longenoughpassword" }).success).toBe(true);
  });
});

describe("UpdateProfileSchema", () => {
  it("rejects an empty display name", () => {
    expect(UpdateProfileSchema.safeParse({ displayName: "" }).success).toBe(false);
  });

  it("accepts a valid display name", () => {
    expect(UpdateProfileSchema.safeParse({ displayName: "Alice Smith" }).success).toBe(true);
  });
});

describe("UpdatePasswordSchema", () => {
  it("rejects a password shorter than 10 characters", () => {
    expect(UpdatePasswordSchema.safeParse({ password: "short123" }).success).toBe(false);
  });

  it("accepts a valid password", () => {
    expect(UpdatePasswordSchema.safeParse({ password: "mynewpassword1" }).success).toBe(true);
  });
});

describe("UpdateEmailSchema", () => {
  it("rejects an invalid email address", () => {
    expect(UpdateEmailSchema.safeParse({ email: "bademail" }).success).toBe(false);
  });

  it("accepts a valid email address", () => {
    expect(UpdateEmailSchema.safeParse({ email: "new@example.com" }).success).toBe(true);
  });
});
