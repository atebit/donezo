"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/shared/Avatar";
import { InviteModal } from "@/components/shared/InviteModal";
import { Button } from "@/components/ui/button";
import {
  removeWorkspaceMember,
  resendInvitation,
  revokeInvitation,
  setWorkspaceMemberRole,
} from "./actions";

export interface WorkspaceMemberRow {
  userId: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

export interface PendingInvitationRow {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

interface MembersTableProps {
  workspaceId: string;
  currentUserId: string;
  currentUserRole: string;
  members: WorkspaceMemberRow[];
  invitations: PendingInvitationRow[];
}

const ROLES = ["owner", "admin", "member", "viewer"] as const;
type Role = (typeof ROLES)[number];

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

function RoleSelect({
  workspaceId,
  userId,
  currentRole,
  disabled,
  disabledTitle,
}: {
  workspaceId: string;
  userId: string;
  currentRole: string;
  disabled?: boolean;
  disabledTitle?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const role = e.target.value as Role;
    startTransition(async () => {
      const result = await setWorkspaceMemberRole({ workspaceId, userId, role });
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
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r.charAt(0).toUpperCase() + r.slice(1)}
        </option>
      ))}
    </select>
  );
}

function RemoveMemberButton({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      const result = await removeWorkspaceMember({ workspaceId, userId });
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

export function MembersTable({
  workspaceId,
  currentUserId,
  currentUserRole,
  members,
  invitations,
}: MembersTableProps) {
  const [inviteOpen, setInviteOpen] = useState(false);

  const canAdmin = currentUserRole === "admin" || currentUserRole === "owner";

  return (
    <div className="flex flex-col gap-8">
      {/* Members section */}
      <section aria-labelledby="members-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="members-heading"
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
                const selfDemoteTitle =
                  "Owners cannot demote themselves; have another owner change your role first.";
                const roleDisabled = isSelf && member.role === "owner";

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
                      {canAdmin ? (
                        <RoleSelect
                          workspaceId={workspaceId}
                          userId={member.userId}
                          currentRole={member.role}
                          disabled={roleDisabled}
                          disabledTitle={selfDemoteTitle}
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
                        <RemoveMemberButton workspaceId={workspaceId} userId={member.userId} />
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
        <section aria-labelledby="invitations-heading">
          <h2
            id="invitations-heading"
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

      {/* Invite Modal */}
      <InviteModal workspaceId={workspaceId} open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
