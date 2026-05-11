"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setBoardPrivacy } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/settings/general/actions";
import {
  resendInvitation,
  revokeInvitation,
} from "@/app/(app)/w/[workspaceSlug]/settings/members/actions";
import { Avatar } from "@/components/shared/Avatar";
import { InviteModal } from "@/components/shared/InviteModal";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/authorization";
import { removeBoardMember, setBoardMemberRole } from "./actions";

export interface BoardMemberRow {
  userId: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

export interface PendingBoardInvitationRow {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

interface BoardMembersTableProps {
  workspaceId: string;
  boardId: string;
  currentUserId: string;
  currentBoardRole: Role;
  isPrivate: boolean;
  members: BoardMemberRow[];
  invitations: PendingBoardInvitationRow[];
}

// Board member roles available for assignment (no "owner" to avoid confusion with workspace owner)
const BOARD_ROLES = ["admin", "member", "viewer"] as const;
type BoardRole = (typeof BOARD_ROLES)[number];

function relativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? "s" : ""} ago`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears !== 1 ? "s" : ""} ago`;
}

function BoardRoleSelect({
  boardId,
  userId,
  currentRole,
  disabled,
  disabledTitle,
}: {
  boardId: string;
  userId: string;
  currentRole: string;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const role = e.target.value as BoardRole;
    startTransition(async () => {
      const result = await setBoardMemberRole({ boardId, userId, role });
      if (result.ok) {
        toast.success("Role updated.");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <select
      value={currentRole}
      onChange={handleChange}
      disabled={disabled || pending}
      title={disabled ? disabledTitle : undefined}
      className="rounded border border-[color:var(--color-border)] bg-surface px-2 py-1 text-sm text-[color:var(--color-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="Member role"
    >
      {BOARD_ROLES.map((r) => (
        <option key={r} value={r}>
          {r.charAt(0).toUpperCase() + r.slice(1)}
        </option>
      ))}
    </select>
  );
}

function RemoveBoardMemberButton({ boardId, userId }: { boardId: string; userId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      const result = await removeBoardMember({ boardId, userId });
      if (result.ok) {
        toast.success("Member removed.");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleRemove}
      disabled={pending}
      className="rounded px-2 py-1 text-sm text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
      aria-label="Remove member"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}

function InvitationActions({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [resendPending, startResendTransition] = useTransition();
  const [revokePending, startRevokeTransition] = useTransition();

  function handleResend() {
    startResendTransition(async () => {
      const result = await resendInvitation({ invitationId });
      if (result.ok) {
        toast.success("Invitation resent.");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  function handleRevoke() {
    startRevokeTransition(async () => {
      const result = await revokeInvitation({ invitationId });
      if (result.ok) {
        toast.success("Invitation revoked.");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={handleResend}
        disabled={resendPending || revokePending}
        className="rounded px-2 py-1 text-sm text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-selected)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--color-primary)]"
      >
        {resendPending ? "Resending…" : "Resend"}
      </button>
      <button
        type="button"
        onClick={handleRevoke}
        disabled={resendPending || revokePending}
        className="rounded px-2 py-1 text-sm text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive"
      >
        {revokePending ? "Revoking…" : "Revoke"}
      </button>
    </div>
  );
}

export function BoardMembersTable({
  workspaceId,
  boardId,
  currentUserId,
  currentBoardRole,
  isPrivate,
  members,
  invitations,
}: BoardMembersTableProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inviteOpen, setInviteOpen] = useState(false);
  const canAdmin = currentBoardRole === "admin" || currentBoardRole === "owner";

  function handleMakePrivate() {
    const ok = window.confirm(
      "Making this board private will hide it from workspace members who aren't invited. Continue?",
    );
    if (!ok) return;
    startTransition(async () => {
      const result = await setBoardPrivacy({ boardId, isPrivate: true });
      if (result.ok) {
        toast.success("Board is now private.");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  // Public board notice
  if (!isPrivate) {
    return (
      <div className="flex flex-col gap-6">
        <section
          aria-labelledby="public-board-notice-heading"
          className="rounded-xl border border-[color:var(--color-border)] bg-surface p-6"
        >
          <h2
            id="public-board-notice-heading"
            className="mb-2 text-base font-semibold text-[color:var(--color-fg-strong)]"
          >
            Members
          </h2>
          <p className="mb-4 text-sm text-[color:var(--color-fg-muted)]">
            This board is visible to all workspace members. Make it private to manage members
            individually.
          </p>
          {canAdmin && (
            <Button size="sm" variant="outline" onClick={handleMakePrivate} disabled={pending}>
              {pending ? "Updating…" : "Make private"}
            </Button>
          )}
        </section>
      </div>
    );
  }

  // Private board — full members table
  return (
    <div className="flex flex-col gap-8">
      {/* Members section */}
      <section aria-labelledby="board-members-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="board-members-heading"
            className="text-base font-semibold text-[color:var(--color-fg-strong)]"
          >
            Members{" "}
            <span className="ml-1 text-sm font-normal text-[color:var(--color-fg-muted)]">
              ({members.length})
            </span>
          </h2>
          {canAdmin && (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              Invite members
            </Button>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)] bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-border)] text-left">
                <th className="px-4 py-3 font-medium text-[color:var(--color-fg-muted)]">Name</th>
                <th className="px-4 py-3 font-medium text-[color:var(--color-fg-muted)]">Email</th>
                <th className="px-4 py-3 font-medium text-[color:var(--color-fg-muted)]">Role</th>
                <th className="px-4 py-3 font-medium text-[color:var(--color-fg-muted)]">Joined</th>
                <th className="px-4 py-3 font-medium text-[color:var(--color-fg-muted)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isSelf = member.userId === currentUserId;

                return (
                  <tr
                    key={member.userId}
                    className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-row-hover)] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Avatar
                          src={member.avatarUrl}
                          displayName={member.displayName}
                          email={member.email}
                          size={26}
                        />
                        <span className="font-medium text-[color:var(--color-fg)]">
                          {member.displayName ?? member.email ?? "Unknown"}
                          {isSelf && (
                            <span className="ml-1.5 text-xs text-[color:var(--color-fg-muted)]">
                              (you)
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-fg-muted)]">
                      {member.email ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {canAdmin && !isSelf ? (
                        <BoardRoleSelect
                          boardId={boardId}
                          userId={member.userId}
                          currentRole={member.role}
                        />
                      ) : (
                        <span className="capitalize text-[color:var(--color-fg-muted)]">
                          {member.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-fg-muted)]">
                      {relativeTime(member.joinedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {canAdmin && !isSelf ? (
                        <RemoveBoardMemberButton boardId={boardId} userId={member.userId} />
                      ) : (
                        <span className="text-[color:var(--color-fg-subtle)]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pending invitations section */}
      {invitations.length > 0 && (
        <section aria-labelledby="board-invitations-heading">
          <h2
            id="board-invitations-heading"
            className="mb-4 text-base font-semibold text-[color:var(--color-fg-strong)]"
          >
            Pending invitations{" "}
            <span className="ml-1 text-sm font-normal text-[color:var(--color-fg-muted)]">
              ({invitations.length})
            </span>
          </h2>
          <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)] bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] text-left">
                  <th className="px-4 py-3 font-medium text-[color:var(--color-fg-muted)]">
                    Email
                  </th>
                  <th className="px-4 py-3 font-medium text-[color:var(--color-fg-muted)]">Role</th>
                  <th className="px-4 py-3 font-medium text-[color:var(--color-fg-muted)]">
                    Expires
                  </th>
                  <th className="px-4 py-3 font-medium text-[color:var(--color-fg-muted)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-surface-row-hover)] transition-colors"
                  >
                    <td className="px-4 py-3 text-[color:var(--color-fg)]">{inv.email}</td>
                    <td className="px-4 py-3 capitalize text-[color:var(--color-fg-muted)]">
                      {inv.role}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-fg-muted)]">
                      {relativeTime(inv.expiresAt)}
                    </td>
                    <td className="px-4 py-3">
                      {canAdmin && <InvitationActions invitationId={inv.id} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <InviteModal
        workspaceId={workspaceId}
        boardId={boardId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </div>
  );
}
