"use client";

import { Dialog } from "@base-ui/react/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { inviteToWorkspace } from "@/app/(app)/w/[workspaceSlug]/actions";
import { inviteToBoard } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Client-side schema: comma-separated emails + role
const InviteFormSchema = z.object({
  emails: z
    .string()
    .min(1, "Enter at least one email address.")
    .refine(
      (val) =>
        val
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean)
          .every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
      { message: "One or more email addresses are invalid." },
    ),
  role: z.enum(["admin", "member", "viewer"]),
});
type InviteFormValues = z.infer<typeof InviteFormSchema>;

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
] as const;

export interface InviteModalProps {
  workspaceId: string;
  boardId?: string; // when present, invites are scoped to this board
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteModal({ workspaceId, boardId, open, onOpenChange }: InviteModalProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(InviteFormSchema),
    defaultValues: { emails: "", role: "member" },
  });

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  function onSubmit(values: InviteFormValues) {
    const emailList = values.emails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    startTransition(async () => {
      const toastId = toast.loading("Sending invitations…");
      const errors: string[] = [];

      for (const email of emailList) {
        const result = boardId
          ? await inviteToBoard({ boardId, email, role: values.role })
          : await inviteToWorkspace({ workspaceId, email, role: values.role });
        if (!result.ok) {
          errors.push(`${email}: ${result.error.message}`);
        }
      }

      if (errors.length === 0) {
        toast.success(
          emailList.length === 1 ? "Invitation sent." : `${emailList.length} invitations sent.`,
          { id: toastId },
        );
        handleClose();
        router.refresh();
      } else {
        toast.error(errors.join("\n"), { id: toastId });
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !pending && onOpenChange(nextOpen)}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-50 bg-[color:var(--color-overlay)]"
          style={{ backdropFilter: "blur(2px)" }}
        />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl bg-surface p-6 shadow-[var(--shadow-modal)] focus:outline-none"
          aria-labelledby="invite-modal-title"
        >
          <Dialog.Title
            id="invite-modal-title"
            className="mb-4 text-base font-semibold text-[color:var(--color-fg-strong)]"
          >
            Invite members
          </Dialog.Title>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-emails">Email addresses</Label>
              <Input
                id="invite-emails"
                type="text"
                placeholder="jane@example.com, bob@example.com"
                required
                aria-invalid={!!errors.emails}
                aria-describedby={errors.emails ? "invite-emails-error" : "invite-emails-hint"}
                {...register("emails")}
              />
              <p id="invite-emails-hint" className="text-xs text-[color:var(--color-fg-muted)]">
                Separate multiple addresses with commas.
              </p>
              {errors.emails && (
                <p id="invite-emails-error" className="text-sm text-destructive" role="alert">
                  {errors.emails.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <select
                id="invite-role"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                required
                aria-invalid={!!errors.role}
                aria-describedby={errors.role ? "invite-role-error" : undefined}
                {...register("role")}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {errors.role && (
                <p id="invite-role-error" className="text-sm text-destructive" role="alert">
                  {errors.role.message}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" disabled={pending} onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Sending…" : "Send invitations"}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
