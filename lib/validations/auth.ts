import { z } from "zod";

const Email = z.string().email("Enter a valid email.");
const Password = z.string().min(10, "Password must be at least 10 characters.");
const DisplayName = z
  .string()
  .min(1, "Name is required.")
  .max(80, "Name must be 80 characters or fewer.");

export const SignInSchema = z.object({
  email: Email,
  password: z.string().min(1, "Password is required."),
});
export type SignInInput = z.infer<typeof SignInSchema>;

export const SignUpSchema = z.object({
  email: Email,
  password: Password,
  displayName: DisplayName,
});
export type SignUpInput = z.infer<typeof SignUpSchema>;

export const ForgotPasswordSchema = z.object({ email: Email });
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({ password: Password });
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const UpdateProfileSchema = z.object({ displayName: DisplayName });
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

export const UpdatePasswordSchema = z.object({ password: Password });
export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>;

export const UpdateEmailSchema = z.object({ email: Email });
export type UpdateEmailInput = z.infer<typeof UpdateEmailSchema>;
