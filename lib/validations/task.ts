import { z } from "zod";

export const CreateTaskSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().max(500).default(""),
  position: z.number(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const RenameTaskSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().max(500),
});
export type RenameTaskInput = z.infer<typeof RenameTaskSchema>;

export const DuplicateTaskSchema = z.object({
  taskId: z.string().uuid(),
});
export type DuplicateTaskInput = z.infer<typeof DuplicateTaskSchema>;

export const DeleteTaskSchema = z.object({
  taskId: z.string().uuid(),
});
export type DeleteTaskInput = z.infer<typeof DeleteTaskSchema>;

export const MoveTaskSchema = z.object({
  taskId: z.string().uuid(),
  groupId: z.string().uuid(),
  position: z.number(),
});
export type MoveTaskInput = z.infer<typeof MoveTaskSchema>;

const taskIdArray = z.array(z.string().uuid()).min(1).max(500);

export const BulkDeleteTasksSchema = z.object({
  taskIds: taskIdArray,
});
export type BulkDeleteTasksInput = z.infer<typeof BulkDeleteTasksSchema>;

export const BulkDuplicateTasksSchema = z.object({
  taskIds: taskIdArray,
});
export type BulkDuplicateTasksInput = z.infer<typeof BulkDuplicateTasksSchema>;

export const BulkMoveTasksToGroupSchema = z.object({
  taskIds: taskIdArray,
  groupId: z.string().uuid(),
});
export type BulkMoveTasksToGroupInput = z.infer<typeof BulkMoveTasksToGroupSchema>;
