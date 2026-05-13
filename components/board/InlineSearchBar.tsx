"use client";

/**
 * InlineSearchBar — thin host wrapper for <SearchInput> in the ViewToolbar.
 *
 * Provides the flex-grow spacer so the search input appears right-aligned
 * relative to the toolbar's left-side action buttons.
 *
 * Rendered inside <ViewToolbar> after the density toggle and before
 * the Save/Reset buttons.
 */

import { SearchInput } from "@/components/filters/SearchInput";

export function InlineSearchBar() {
  return (
    // flex-1 causes the search bar to consume remaining horizontal space,
    // right-aligning itself between density (left) and save/reset (right end).
    <div className="flex items-center flex-1 justify-end">
      <SearchInput />
    </div>
  );
}
