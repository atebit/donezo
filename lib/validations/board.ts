import { z } from "zod";

export const CreateBoardSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(5000).default(""),
  isPrivate: z.boolean().default(false),
  template: z.enum(["blank"]).default("blank"),
});
export type CreateBoardInput = z.infer<typeof CreateBoardSchema>;

export const RenameBoardSchema = z.object({
  boardId: z.string().uuid(),
  name: z.string().min(1).max(120),
});
export type RenameBoardInput = z.infer<typeof RenameBoardSchema>;

export const UpdateBoardDescriptionSchema = z.object({
  boardId: z.string().uuid(),
  description: z.string().max(5000),
});
export type UpdateBoardDescriptionInput = z.infer<typeof UpdateBoardDescriptionSchema>;

export const SetBoardPrivacySchema = z.object({
  boardId: z.string().uuid(),
  isPrivate: z.boolean(),
});
export type SetBoardPrivacyInput = z.infer<typeof SetBoardPrivacySchema>;

export const StarBoardSchema = z.object({
  boardId: z.string().uuid(),
  starred: z.boolean(),
});
export type StarBoardInput = z.infer<typeof StarBoardSchema>;

export const ArchiveBoardSchema = z.object({ boardId: z.string().uuid() });
export type ArchiveBoardInput = z.infer<typeof ArchiveBoardSchema>;

export const RestoreBoardSchema = z.object({ boardId: z.string().uuid() });
export type RestoreBoardInput = z.infer<typeof RestoreBoardSchema>;

export const DeleteBoardSchema = z.object({
  boardId: z.string().uuid(),
  confirmName: z.string().min(1),
});
export type DeleteBoardInput = z.infer<typeof DeleteBoardSchema>;

export const DuplicateBoardSchema = z.object({ boardId: z.string().uuid() });
export type DuplicateBoardInput = z.infer<typeof DuplicateBoardSchema>;

export const SetBoardMemberRoleSchema = z.object({
  boardId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["admin", "member", "viewer"]),
});
export type SetBoardMemberRoleInput = z.infer<typeof SetBoardMemberRoleSchema>;

export const RemoveBoardMemberSchema = z.object({
  boardId: z.string().uuid(),
  userId: z.string().uuid(),
});
export type RemoveBoardMemberInput = z.infer<typeof RemoveBoardMemberSchema>;
