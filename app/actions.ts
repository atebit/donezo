"use server";
import { withUser } from "@/lib/actions";

export const pingAction = withUser(async ({ userId }) => {
  return { pong: true as const, userId, timestamp: new Date().toISOString() };
});
