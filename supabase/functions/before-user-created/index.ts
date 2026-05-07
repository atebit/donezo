// Supabase Auth Hook: before-user-created.
// Runs in Deno. Configure in Supabase dashboard → Authentication → Hooks.
// Env: ALLOWED_DOMAINS — comma-separated. Empty / unset = allow all.

// deno-lint-ignore-file no-explicit-any
Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const email: string | undefined = payload?.user?.email;
    const allowedRaw = Deno.env.get("ALLOWED_DOMAINS") ?? "";
    const allowed = allowedRaw
      .split(",")
      .map((d: string) => d.trim().toLowerCase())
      .filter(Boolean);

    // Wide-open: no allowlist configured.
    if (allowed.length === 0) {
      return new Response(JSON.stringify({ decision: "continue" }), {
        headers: { "content-type": "application/json" },
      });
    }

    if (!email) {
      return new Response(JSON.stringify({ decision: "reject", message: "Email required" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain || !allowed.includes(domain)) {
      return new Response(
        JSON.stringify({
          decision: "reject",
          message: `Sign-up is restricted. Contact your admin if you should have access.`,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ decision: "continue" }), {
      headers: { "content-type": "application/json" },
    });
  } catch (_err) {
    // Fail open on hook errors — better than locking everyone out.
    return new Response(JSON.stringify({ decision: "continue" }), {
      headers: { "content-type": "application/json" },
    });
  }
});
