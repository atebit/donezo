import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";
import { WorkspaceLogoTile } from "@/components/shared/WorkspaceLogoTile";
import { createClient } from "@/lib/supabase/server";
import { acceptInvitation } from "./actions";

// Card chrome shared by all states on this page (matches auth layout inner card).
function CardShell({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-6">{children}</div>;
}

// Heading block consistent with auth pages.
function CardHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();

  // ── Server actions ────────────────────────────────────────────────────────
  async function accept() {
    "use server";
    const result = await acceptInvitation({ token });
    if (!result.ok) {
      redirect(`/join/${token}?error=${encodeURIComponent(result.error.message)}`);
    }
    // After acceptance, land on the specific resource the invitation granted.
    // Re-read the invitation post-accept to get workspace.slug + board.id without
    // depending on closure values from before the action ran.
    const supabase = await createClient();
    const { data: inv } = await supabase
      .from("invitation")
      .select("workspace:workspace_id ( slug ), board:board_id ( id )")
      .eq("token", token)
      .maybeSingle();
    const ws = inv?.workspace as { slug: string } | null;
    const bd = inv?.board as { id: string } | null;
    if (ws && bd) {
      redirect(`/w/${ws.slug}/b/${bd.id}`);
    }
    if (ws) {
      redirect(`/w/${ws.slug}`);
    }
    redirect("/");
  }

  async function handleSignOut() {
    "use server";
    await signOut();
  }

  // ── Fetch invitation ──────────────────────────────────────────────────────
  const { data: inv } = await supabase
    .from("invitation")
    .select(
      `
      id,
      role,
      accepted_at,
      expires_at,
      revoked_at,
      email,
      workspace:workspace_id ( id, name, slug ),
      board:board_id ( id, name )
    `,
    )
    .eq("token", token)
    .maybeSingle();

  // ── State: invitation not found ───────────────────────────────────────────
  if (!inv) {
    return (
      <CardShell>
        <CardHeading
          title="Invitation not found"
          description="This invitation link is invalid or has expired."
        />
        <p className="text-sm text-muted-foreground">
          Ask the person who invited you to send a new link.
        </p>
        <Link
          href="/sign-in"
          className="text-sm text-[color:var(--color-link)] underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </CardShell>
    );
  }

  // ── State: already accepted ───────────────────────────────────────────────
  if (inv.accepted_at) {
    return (
      <CardShell>
        <CardHeading
          title="Already accepted"
          description="This invitation has already been accepted."
        />
        <Link
          href="/"
          className="text-sm text-[color:var(--color-link)] underline-offset-4 hover:underline"
        >
          Go to Donezo
        </Link>
      </CardShell>
    );
  }

  // ── State: revoked ────────────────────────────────────────────────────────
  if (inv.revoked_at) {
    return (
      <CardShell>
        <CardHeading
          title="Invitation revoked"
          description="This invitation has been revoked by the workspace admin."
        />
        <p className="text-sm text-muted-foreground">
          Contact the workspace owner if you believe this was a mistake.
        </p>
        <Link
          href="/sign-in"
          className="text-sm text-[color:var(--color-link)] underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </CardShell>
    );
  }

  // ── State: expired ────────────────────────────────────────────────────────
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
    return (
      <CardShell>
        <CardHeading title="Invitation expired" description="This invitation link has expired." />
        <p className="text-sm text-muted-foreground">
          Ask the person who invited you to send a new link.
        </p>
        <Link
          href="/sign-in"
          className="text-sm text-[color:var(--color-link)] underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </CardShell>
    );
  }

  // ── Auth check ────────────────────────────────────────────────────────────
  // Redirect unauthenticated visitors to sign-in, then bounce back here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(`/join/${token}`)}`);
  }

  // ── State: email mismatch ─────────────────────────────────────────────────
  const emailsMatch = user.email?.toLowerCase() === inv.email.toLowerCase();

  if (!emailsMatch) {
    return (
      <CardShell>
        <CardHeading
          title="Wrong account"
          description={`This invitation was sent to ${inv.email}.`}
        />
        <p className="text-sm text-muted-foreground">
          Please sign in with that email address to accept the invitation.
        </p>
        <form action={handleSignOut}>
          <button
            type="submit"
            className="w-full rounded-lg border border-[color:var(--color-border-solid)] bg-[color:var(--color-surface)] px-4 py-2 text-sm font-medium text-[color:var(--color-fg)] transition-colors hover:bg-[color:var(--color-surface-row-hover)]"
          >
            Sign out and switch account
          </button>
        </form>
      </CardShell>
    );
  }

  // ── State: active invitation ──────────────────────────────────────────────
  // Cast relation shapes — generated types don't model joined relations.
  const workspace = inv.workspace as { id: string; name: string; slug: string } | null;
  const board = inv.board as { id: string; name: string } | null;

  return (
    <CardShell>
      {/* Workspace identity */}
      <div className="flex items-center gap-3">
        <WorkspaceLogoTile workspaceName={workspace?.name ?? null} size={30} />
        <span className="text-sm font-medium text-[color:var(--color-fg)]">
          {workspace?.name ?? "Workspace"}
        </span>
      </div>

      {/* Heading */}
      <CardHeading
        title="You've been invited"
        description={`Join ${workspace?.name ?? "this workspace"} as ${inv.role}.`}
      />

      {/* Board context (if board-scoped invitation) */}
      {board ? (
        <p className="text-sm text-muted-foreground">
          Board: <span className="font-medium text-[color:var(--color-fg)]">{board.name}</span>
        </p>
      ) : null}

      {/* Error feedback */}
      {error ? (
        <p
          role="alert"
          className="rounded-md bg-[color:var(--color-label-red)]/10 px-3 py-2 text-sm text-[color:var(--color-label-red)]"
        >
          {error}
        </p>
      ) : null}

      {/* Accept form */}
      <form action={accept}>
        <button
          type="submit"
          className="w-full rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-medium text-[color:var(--color-primary-foreground)] transition-colors hover:bg-[color:var(--color-primary-hover)]"
        >
          Accept invitation
        </button>
      </form>

      {/* Decline link */}
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t want to join?{" "}
        <Link href="/" className="underline underline-offset-4 hover:text-[color:var(--color-fg)]">
          Decline
        </Link>
      </p>
    </CardShell>
  );
}
