import { IconStar } from "@/lib/icons";
import { EmptyState } from "./EmptyState";

export function FavoritesEmpty() {
  return (
    <EmptyState
      icon={IconStar}
      title="Easily Access Your Favorite Boards"
      description="Star a board to pin it here for quick access."
    />
  );
}
