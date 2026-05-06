"use server";
import { type ActionResult, withUser } from "@/lib/actions";

export const pingAction = withUser(
  async ({ user }): Promise<ActionResult<{ pong: true; userId: string; timestamp: string }>> => {
    return {
      ok: true,
      data: { pong: true, userId: user.id, timestamp: new Date().toISOString() },
    };
  },
);
