"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Avatar } from "@/components/shared/Avatar";
import { cn } from "@/lib/utils";

export interface MemberModalMember {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string;
}

export interface MemberModalProps {
  members: MemberModalMember[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium capitalize",
        "bg-[color:var(--color-surface-hover)] text-[color:var(--color-fg-muted)]",
      )}
    >
      {role}
    </span>
  );
}

/**
 * MemberModal — presentational display of workspace/board members.
 * No mutations; display-only.
 */
export function MemberModal({ members, open, onOpenChange, title = "Members" }: MemberModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-50 bg-[color:var(--color-overlay)]"
          style={{ backdropFilter: "blur(2px)" }}
        />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl bg-surface p-5 shadow-[var(--shadow-modal)] focus:outline-none"
          aria-labelledby="member-modal-title"
        >
          <Dialog.Title
            id="member-modal-title"
            className="mb-4 text-base font-semibold text-[color:var(--color-fg-strong)]"
          >
            {title}
          </Dialog.Title>

          {members.length === 0 ? (
            <p className="text-sm text-[color:var(--color-fg-muted)]">No members yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-3 rounded-[8px] px-2 py-1.5"
                  style={{ backgroundColor: "var(--color-chip-member)" }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar
                      src={member.avatarUrl}
                      displayName={member.displayName}
                      email={member.email}
                      size={22}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[color:var(--color-fg)]">
                        {member.displayName ?? member.email ?? "Unknown"}
                      </p>
                      {member.displayName && member.email && (
                        <p className="truncate text-xs text-[color:var(--color-fg-muted)]">
                          {member.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <RoleBadge role={member.role} />
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex justify-end">
            <Dialog.Close className="rounded-md px-3 py-1.5 text-sm font-medium text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]">
              Close
            </Dialog.Close>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
