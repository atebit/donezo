"use client";

/**
 * BoardTableView — responsive wrapper that gates the table view on md+ breakpoint.
 *
 * Below 768px (md): renders <BoardCardList /> — mobile card list.
 * At 768px+:       renders <BoardTable />    — full virtual table.
 *
 * Data fetching is done once by <BoardDataProvider> in the board layout;
 * both views read from the already-hydrated board store. No duplication.
 *
 * Epic 14 / Slice D.
 */

import { BoardCardList } from "@/components/board/cards/BoardCardList";
import { useMediaQuery } from "@/hooks/use-media-query";
import { BoardTable } from "./BoardTable";

export function BoardTableView() {
  // SSR-safe: returns false on server + until first mount. The table renders
  // by default (false = not desktop). After mount, correct view snaps in.
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return <BoardTable />;
  }

  return <BoardCardList />;
}
