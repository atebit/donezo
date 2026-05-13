import { IconArchive } from "@/lib/icons";
import { EmptyState } from "./EmptyState";

export function TrashEmpty() {
  return (
    <EmptyState
      icon={IconArchive}
      title="Trash is empty"
      description="Deleted boards will appear here. You can restore or permanently delete them."
    />
  );
}
