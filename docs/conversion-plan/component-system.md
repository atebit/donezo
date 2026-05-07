# Donezo Component System (Locked)

The companion to [`design-system.md`](design-system.md). This doc inventories every legacy component that has product meaning and locks down its visual + interaction contract for the new app.

**Translation rule:** legacy components are CRA + SCSS + MUI. New components are RSC where possible, `"use client"` where interaction is required, styled via shadcn/ui (Base UI primitives) + Tailwind tokens. We rebuild from these specs, not from JSX.

**Marketing/landing components are not ported.** The legacy `cmps/home/`, `cmps/custom/`, and `home-header.jsx` are out of scope. The new app's only public route is the Google sign-in screen ([03](03-auth.md)).

**File path conventions in this doc:**
- Legacy JSX: `frontend/src/cmps/<area>/<file>.jsx`
- Legacy SCSS: `frontend/src/assets/styles/cmps/<…>/<file>.scss`
- New components land under `components/<area>/<Name>.tsx` per the layout in [00-overview.md](00-overview.md)

Each entry below has the same shape:
- **What** — purpose
- **Where** — appears on which routes
- **Visual contract** — states, key dimensions, exact tokens
- **Interaction contract** — hover, focus, transitions, drag, optimistic UI
- **Lands in** — the epic that ships it
- **Fidelity bar** — `must-match` (every detail), `match` (visual + interaction match, deviations allowed if reasoned), or `inspired` (free to redesign within the system)

---

## 0. The Monday-feel must-haves

These five components carry most of the product's visual identity. If any of them ship as generic shadcn defaults, the app will look wrong even if every other pixel is right. Tag them `must-match` and review screenshots before merge:

1. **Status / priority pill** with the diagonal "fold" reveal on hover
2. **Group header** with the colored 6px left stripe and sticky behavior
3. **Task row** with the inline blockquote title, hover-revealed menu, and "on-typing" wash
4. **Workspace sidebar** with the slide-out collapse and pill-shaped toggle handle
5. **Get-started CTA** (gradient pill button with the shifting arrow)

---

## 1. Layout shells

### 1.1 `MainSidebar` (icon column)

- **What:** the leftmost vertical rail containing brand glyph, tool icons, user avatar, and login menu.
- **Where:** `app/(app)/layout.tsx` — every authed route.
- **Legacy:** `frontend/src/cmps/sidebar/main-sidebar.jsx`, [_main-sidebar.scss](../../frontend/src/assets/styles/cmps/sidebar/_main-sidebar.scss).
- **Visual contract:**
  - Background `--color-surface-nav` (`#292f4c`), full-height, `position: sticky; top: 0`.
  - Min width `66px` desktop. On mobile (`max-md`) collapses to a 8vh bottom bar (`position: fixed; bottom: 0; flex-direction: row`).
  - Internal sections: brand link top, tools middle (with `border-top` + `border-bottom` in `--color-border` 40%), bottom for menu icon + avatar.
  - Tool icon container `56 × 36px`, centered.
  - Avatar `37.4 × 37.4px`, white `1.6px` border, `border-radius: 50%`.
  - Icon glyphs white at `rem(23px)` (`~23px`) base; menu icon at `42 × 42px` in `--color-nav-icon` (`#6c6cff`).
- **Interaction contract:**
  - Tool/menu hover applies `bg-color: rgba(0,0,0,.6)` + `border-radius: 10px`. Use `--color-nav-hover` (token to add: `rgba(0,0,0,.6)` baked into `--color-surface-nav-hover`).
  - Avatar hover: `transform: scale(.9)` over `--motion-base`.
  - Brand link hover: same pattern as tool hover.
  - Mobile: `bottom: 0`, gap `30px`, the open-workspace icon appears (white, 24px).
- **Lands in:** [05](05-workspaces-boards.md).
- **Fidelity bar:** `must-match` — this rail is half of the "Monday look at a glance."

### 1.2 `WorkspaceSidebar` (slide-out workspace panel)

- **What:** secondary rail listing workspace name, workspace tools (Search, Add board, Templates, ...), favorites, and the board list.
- **Where:** `app/(app)/layout.tsx`, slides in/out next to `MainSidebar`.
- **Legacy:** `workspace-sidebar.jsx` + [_workspace-sidebar.scss](../../frontend/src/assets/styles/cmps/sidebar/_workspace-sidebar.scss).
- **Visual contract:**
  - Open: width `230px`. Closed: width `0` (mobile) / `30px` (narrow+).
  - Background `--color-surface-rail` (`#F6F7FB`); right border `1px solid --color-border-rail` (baked `darken($border-color, 30%)`).
  - Header section with workspace logo (`30×30` rounded-`8px` tile in `--color-label-green` with white "lightning" glyph, plus a `home` overlay icon) and bold workspace title at 16px weight 700 in `--color-fg`.
  - Workspace items list: `font-size: 14px`, padding `4px`, gap `6px`. Hover bg `--color-surface-hover`, radius `4px`.
  - Search-board input: `border-radius: 4px`, `height: 31px`. On focus-within: `0.5px` border `--color-primary`, bg white.
  - Favorites empty-state: 80px star icon, centered text in `--color-fg`, line-height `1.5`.
  - "Toggle workspace" pill: absolute, right edge of rail, `top: 13px`. White circle, `1px` border `#c3c6d4`, padding `4px`, radius `20px`. On hover: bg `--color-primary`, color white, padding asymmetric (right shrinks, left grows by `12px`) over `--motion-base`.
- **Interaction contract:**
  - Open/close: width animates over `--motion-slow` (`.4s`); inner header opacity `0 → 1` with `transition-delay: 0.25s` so the chrome appears *after* the rail finishes opening (don't fade them in parallel — the staggered reveal is the look).
  - Active board row: bg `--color-surface-active`, radius `4px`.
  - Mobile open state takes 100vw; toggle pill hidden.
- **Lands in:** [05](05-workspaces-boards.md).
- **Fidelity bar:** `must-match`.

### 1.3 `BoardHeader` (top of board)

- **What:** board title bar with title (inline edit), star, board tools (activity, members, invite), description link, and view tabs.
- **Where:** `app/(app)/w/[slug]/b/[boardId]/layout.tsx`.
- **Legacy:** `board/board-header.jsx` + [_board-header.scss](../../frontend/src/assets/styles/cmps/board/_board-header.scss).
- **Visual contract:**
  - Padding: `16px 30px 0 38px` desktop; `16px 10px 0 10px` mobile.
  - `position: sticky; top: 0; left: 0; z: --z-board-header`. Bg white.
  - Title H1: 24px (narrow+) / 15px (mobile), letter-spacing `0.5px`, color `--color-fg`. Hover shows `1px solid --color-border-strong` border (turns the title into a pre-edit affordance).
  - Star: `--color-label-yellow` when filled.
  - Board tools row: gap 16px, each item `padding: 4px`, radius `6px`, hover bg `--color-surface-hover`.
  - Members avatar pile (`<MemberStack />`): white border, 24px diameter, `-5px` overlap; "+N" overflow tile in white with `1px solid --color-border` and `--color-fg` text.
  - View tabs row: each tab `height: 32px`, padding `0 8px`, `font-size: 14px`, font-weight 500. Active state: bottom border `2px solid --color-primary` (NO animation — snap on).
  - Border line between tabs and content: `1px solid --color-border-strong`.
- **Interaction contract:**
  - Title becomes contenteditable on click; outline `1px solid --color-primary` on focus-visible. (See [Inline editable title](#21-inline-editable-title-blockquote-pattern) below.)
  - Description-link span: color `--color-link`; hover underlines.
  - Tabs hover bg `--color-surface-hover`, radius top-only `4px 4px 0 0`.
- **Lands in:** [05](05-workspaces-boards.md) (skeleton with only Table tab enabled), [12](12-alternate-views.md) (other tabs).
- **Fidelity bar:** `must-match`.

### 1.4 `BoardFilter` toolbar

- **What:** the "+ New Item" split-button, search expander, person filter, and sort/hide/group controls below the board header.
- **Where:** above `<BoardTable />`.
- **Legacy:** `board/board-filter.jsx` + [_board-filter.scss](../../frontend/src/assets/styles/cmps/board/_board-filter.scss).
- **Visual contract:**
  - Row gap `5px`; each tool `height: 32px`, `font-size: 14px`.
  - Tools (`Person/Filter/Sort/Hide/Group/Search`): padding `0 8px`, color `--color-fg-muted`, glyph `18px`. Hover bg `--color-surface-hover`, radius `4px`.
  - **Primary "New Item" split-button** (the visual anchor of the toolbar):
    - Outer container bg `--color-primary`, radius `5px`, `height: 32px`, white text.
    - Left half (`.new-task-btn`): padding `4px 8px`. Hover bg `--color-primary-hover`, only the left two corners round (5px). Transition `--motion-slow`.
    - Right half (`.drop-down-btn`): `1px` left border `--color-primary-hover`, padding `0 8px`, chevron `15px`. Hover bg `--color-primary-hover`, only right two corners round.
  - Search input: collapsed width `58px`. On focus-within: chrome border `0.5px --color-primary`, bg white. On focus: input width animates `58 → 140px` over `--motion-medium`.
  - Person-filter chip when active: bg `--color-primary-selected`, radius `4px`.
- **Interaction contract:**
  - Search transitions cursor `pointer → text` on focus.
  - Filter/sort/hide/group open popovers (`<DynamicModal />` pattern below).
- **Lands in:** [11](11-filtering-views.md). (A simplified search-only version may ship in [06](06-groups-tasks-table.md) — the split-button itself ships there.)
- **Fidelity bar:** `must-match` (the split-button), `match` (rest).

### 1.5 ~~Marketing header~~ — REMOVED

Marketing surfaces are out of scope per [00-overview.md](00-overview.md). The only public route is Google sign-in ([03](03-auth.md)). No `<HomeHeader />`, no landing page.

---

## 2. Board work surface

### 2.1 Inline-editable title (blockquote pattern)

- **What:** a `<blockquote contentEditable>` that swaps from display to edit on focus. Used for the board title, group title, task title, and board description.
- **Visual contract:**
  - Default: borderless, padded.
  - Hover: outline `1px solid --color-border-strong`, radius `5px`.
  - Focus-visible: outline `1px solid --color-primary`, radius `5px`.
  - Editing state ("on-typing"): row bg `--color-surface-active`.
- **Interaction contract:**
  - Click to enter edit mode (no double-click). `Enter` commits + blurs; `Esc` reverts. The whole row enters "on-typing" wash so collaborators see the edit live.
  - On blur, fire optimistic update — see [Optimistic cell pattern](#26-optimistic-cell-pattern).
- **Lands in:** [05](05-workspaces-boards.md) (board title), [06](06-groups-tasks-table.md) (group + task), [09](09-comments-activity.md) (board description).
- **Fidelity bar:** `must-match`.

### 2.2 `GroupHeader`

- **What:** the row that introduces a group of tasks: collapse arrow, colored title, task count, overflow menu.
- **Where:** every board view that shows groups.
- **Legacy:** `board/title-group-preview.jsx` and parts of `group-preview.jsx` + [_group-preview.scss](../../frontend/src/assets/styles/cmps/group/_group-preview.scss).
- **Visual contract:**
  - `position: sticky; top: 182px` (narrow+) / `149px` (mobile); bg white; height `40px`; line-height `24px`.
  - Title H4: font-weight 600, font-size `18px`, padding `4px`, color matches the group's accent (`--color-group-N`).
  - Task count: `font-size: 14px`, color `--color-fg-muted`, opacity `0 → 1` on group hover over `--motion-base`.
  - Arrow chevron: `16px`, `margin-left: 13px`, cursor pointer.
  - Group overflow menu (left, off-canvas): `width: 40px`, sits at `left: -38px`. Glyph `BiDotsHorizontalRounded` 20px. Hidden by default; appears on row hover.
- **Interaction contract:**
  - Hover on group exposes overflow menu glyph.
  - Title becomes editable per [§2.1](#21-inline-editable-title-blockquote-pattern).
  - Active "show border" state: `1px solid --color-primary`, radius `4px`.
- **Lands in:** [06](06-groups-tasks-table.md).
- **Fidelity bar:** `must-match`.

### 2.3 `TaskRow` / `TaskPreview`

- **What:** a single row of the board table. Handles drag handle reveal, checkbox, inline title, comment count, expand-to-drawer link, and the dynamic cells.
- **Where:** every Table view; the row is the core read/write surface.
- **Legacy:** `task/task-preview.jsx` + [_task-preview.scss](../../frontend/src/assets/styles/cmps/_task-preview.scss).
- **Visual contract:**
  - Row height `36px`. Font size `14px`.
  - Sticky-div (left): bg white, `border-left: 6px solid <group-accent>`, sticky at `left: 40px` (mobile `left: 0`, min-width `240px`).
  - Drag/menu handle (`task-menu`): off-canvas at `left: -47px`, `width: 41px`, `height: 40px`. Glyph hidden until row hover.
  - Checkbox cell `33px` wide, `1px solid --color-border-strong`.
  - Title cell `336px` wide, blockquote per [§2.1](#21-inline-editable-title-blockquote-pattern), with `Open` affordance hidden until hover.
  - Comment-count badge: `14×13px` circle, bg `--color-primary`, white text, font-size `10px`, top-right of chat icon.
- **Interaction contract:**
  - Row hover reveals: drag handle, "Open" expand affordance, comment-add icon (default).
  - Editing title applies "on-typing" wash to row + sticky-div.
  - Open affordance navigates to task drawer route.
- **Lands in:** [06](06-groups-tasks-table.md). Cells beyond title are filled in by [07](07-column-system.md).
- **Fidelity bar:** `must-match`.

### 2.4 Cell components (per type)

A shared cell skeleton: `min-width: 140px`, `height: 36px`, `1px solid --color-border-strong` border. Each cell type extends.

| Cell | Legacy SCSS | Key visual | Interaction | Lands in |
|---|---|---|---|---|
| `StatusCell` / `PriorityCell` | [_status-priority-picker.scss](../../frontend/src/assets/styles/cmps/task-picker/_status-priority-picker.scss) | Full-bleed bg = label color; centered white label text; **diagonal "fold" in top-right reveals on hover** (border-width `0 → 10×10 → 15×15px` over `--motion-base` with `transition-delay: .2s`); empty state shows `--color-label-gray` (`#c4c4c4`) bg with no text | Click opens `<StatusPicker />` popover; popover lists labels (centered, fixed-width 152px chips) + "Edit Labels" button bottom (1px top border `--color-border-strong`) | [07](07-column-system.md) |
| `PersonCell` | [_member-picker.scss](../../frontend/src/assets/styles/cmps/task-picker/_member-picker.scss) | Stacked avatars (26px circle, `-5px` overlap); empty state shows muted person glyph; bg neutral | Click opens member-picker modal | [07](07-column-system.md) |
| `DateCell` | [_date-picker.scss](../../frontend/src/assets/styles/cmps/task-picker/_date-picker.scss) | Centered text input; max-width 140px; transparent bg | Hover: `0.2px` border `--color-surface-hover`, text `--color-primary`. Focus: border `--color-primary`. Click opens date popover | [07](07-column-system.md) |
| `NumberCell` | [_number-picker.scss](../../frontend/src/assets/styles/cmps/task-picker/_number-picker.scss) | Centered number input; on hover reveals `+`/`-` icons in `--color-primary` and a `clear` chip top-right (bg `--color-surface-hover`, radius 3px) | Hover reveals controls; focus shows `--color-primary` border | [07](07-column-system.md) |
| `CheckboxCell` | [_checkbox-picker.scss](../../frontend/src/assets/styles/cmps/task-picker/_checkbox-picker.scss) | Centered icon; checked color `--color-primary`, unchecked `--color-fg`. Hover wash `rgba(0,0,0,0.05)` over `--motion-base` | Click toggles | [07](07-column-system.md) |
| `FileCell` | [_file-picker.scss](../../frontend/src/assets/styles/cmps/task-picker/_file-picker.scss) | Hidden file input; centered "+" icon (`19px`, opacity `0 → 1` on hover) | Hover reveals upload affordance; click opens file picker | [10](10-attachments.md) |
| `UpdatedByCell` | [_update-picker.scss](../../frontend/src/assets/styles/cmps/task-picker/_update-picker.scss) | Avatar (26px) + relative time `(2h, 5d, 3w)` from `calculateTime` util | Read-only | [07](07-column-system.md) |
| Other types (`text`, `email`, `phone`, `country`, `link`, `tags`, `rating`, `currency`, `vote`, `week`, `location`, `formula`) | — | Inherit cell skeleton; per-type editor follows the picker patterns above. **Match** the visual rhythm (centered content, `--color-primary` focus border, hover wash) | Open editor on click; ESC cancels, blur commits | [07](07-column-system.md) |

**Fidelity bar for all cells:** `must-match`. The status fold and the `--color-primary` focus borders are characteristic.

### 2.5 Group color stripe

- **What:** the 6px solid left bar on every row, color = group's accent.
- **Where:** every task row, every group header.
- **Visual contract:** see [§2.3](#23-taskrow--taskpreview) sticky-div.
- **Interaction contract:** static. Color is editable via the [color-palette popover](#33-colorpalette-popover).
- **Fidelity bar:** `must-match`.

### 2.6 Optimistic cell pattern

- **Pattern:** on cell change, update Zustand store immediately; fire server action; on success, reconcile via Realtime broadcast; on failure, revert + toast.
- **Visual signal during in-flight edit:** none beyond the "on-typing" wash for inline-editable titles. Cells flick to their new value instantly.
- **Lands in:** [06](06-groups-tasks-table.md) for title; [07](07-column-system.md) per cell type.
- **Fidelity bar:** `must-match`.

---

## 3. Modals & popovers

### 3.1 `DynamicModal` (popover container)

- **What:** the floating popover used for status pickers, priority pickers, group menus, board menus, color palette, etc. Position computed from the click target's rect.
- **Legacy:** `modal/dynamic-modal.jsx` + [_dynamic-modal.scss](../../frontend/src/assets/styles/cmps/modal/_dynamic-modal.scss).
- **Visual contract:**
  - `position: absolute`, bg white, `padding: 8px`, `border-radius: 8px`, `border: 1px solid --color-border-strong`, `box-shadow: --shadow-modal`, `z-index: --z-popover` (1000).
- **Interaction contract:**
  - Open positions are computed from the trigger element. Outside-click + Esc close.
  - Reuse Base UI's `<Popover>` (via shadcn) and apply the legacy chrome.
- **Fidelity bar:** `must-match` chrome; `match` positioning logic (Base UI's Floating UI integration is fine).

### 3.2 `MenuModal` recipe (mixin)

The `@mixin menu-modal()` ([_mixins.scss:107-132](../../frontend/src/assets/styles/setup/_mixins.scss)) is reused by ~10 different menus (task-tools, group-menu, task-menu, login-logout, board-description-modal items). Lock the recipe:

```css
.menu-modal {
  background: var(--color-surface);
  border-radius: var(--radius-md);    /* 8px */
  display: flex;
  flex-direction: column;
  position: absolute;
  top: 40px;
  color: var(--color-fg);
  font-size: 14px;
  z-index: var(--z-rail);             /* 10 */
  padding: 8px;
  box-shadow: var(--shadow-modal);
  border: 1px solid var(--color-border-strong);
}
.menu-modal > * {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
}
.menu-modal > *:hover:not(.color-palette) {
  background: var(--color-surface-hover);
  border-radius: 8px;
}
```

All dropdown menus (board, group, task, add-column, add-group, chart-type, login-logout) use this recipe. Build it once as `<MenuList />` and inherit.

- **Lands in:** [01](01-foundation.md) as a base primitive.
- **Fidelity bar:** `must-match`.

### 3.3 `ColorPalette` popover

- **What:** the 12-swatch grid for picking a group's accent color.
- **Legacy:** `cmps/color-palette.jsx` + [_color-palette-modal.scss](../../frontend/src/assets/styles/cmps/modal/_color-palette-modal.scss).
- **Visual contract:**
  - Container width `142px`, flex-wrap, swatches at margin `5px`.
  - Swatch: `BsFillCircleFill` (Lucide `Circle` filled), font-size `20px`, fill = palette color (one of the 12 group colors).
- **Interaction contract:** click swatch → fires `setGroupColor`. No checkmark on the active swatch in legacy (consider adding for a11y).
- **Lands in:** [06](06-groups-tasks-table.md) (group recolor uses it).
- **Fidelity bar:** `match` (palette is `must-match`; layout flexibility is fine).

### 3.4 `StatusLabelEditor` popover

- **What:** the popover that opens from a status cell to pick or edit labels.
- **Legacy:** `modal/modal-status-priority.jsx` + [_status-priority-modal.scss](../../frontend/src/assets/styles/cmps/modal/_status-priority-modal.scss).
- **Visual contract:**
  - `<ul>` of label chips, padding `8px`, font-size `14px`, gap `8px`, color white.
  - Each chip: min-width `152px`, `height: 32px`, centered. Bg = label color.
  - "Edit Labels" button at the bottom: top border `1px solid --color-border-strong`, button width `152px`, white bg, `--color-fg` text, padding `4px 8px`, glyph 20px. (Triangle indicator visible above the popover).
- **Interaction contract:** click chip selects; "Edit Labels" navigates to label editor (a sub-popover or modal).
- **Lands in:** [07](07-column-system.md) (status/priority cell type).
- **Fidelity bar:** `must-match`.

### 3.5 `TaskDrawer` (right-slide modal)

- **What:** the right-side drawer that opens when a task is expanded. Tabs: Updates / Activity / Files.
- **Legacy:** `modal/task-modal.jsx` + [_board-modal.scss](../../frontend/src/assets/styles/cmps/modal/_board-modal.scss).
- **Visual contract:**
  - `position: fixed; top: 0; right: 0; height: 100vh; min-width: 570px` (mobile: 100vw).
  - Bg white, `border-inline-start: 1px solid #ccc`.
  - Header: `padding: 20px 20px 6px 24px`, height `53px`, font-size `18px`. Close glyph color `#777`.
  - Tab strip: padding `0 24px`, `1px solid --color-border` bottom. Each tab: padding `8px`, font-weight 500, font-size `14px`. Hover bg `--color-surface-hover`, only top corners round (`4px 4px 0 0`). Active: bottom border `2px solid --color-primary`.
  - Content area `85vh` scroll, scrollbar hidden (`::-webkit-scrollbar { display: none }`).
  - Update editor card: `outline: 1px solid --color-primary`, `border-radius: 4px`, height `145px`. Toolbar row with style toggles each `4px 8px`, hover bg `--color-surface-hover`. Save button: bg `--color-primary` white, `height: 32px`, `border-radius: 4px`, hover `--color-primary-hover`.
- **Interaction contract:**
  - Slide in: `transform: translateX(100% → 0)` over `--motion-drawer` (`.6s`), shadow fades in.
  - Outside click + Esc close. Route stays at `…/t/[taskId]`.
- **Lands in:** [09](09-comments-activity.md) (drawer + Updates tab + Activity tab); Files tab in [10](10-attachments.md).
- **Fidelity bar:** `must-match`.

### 3.6 `BoardDescriptionModal` (centered, two-pane)

- **What:** big info modal showing the board description on the left and meta (created-by, members, lightning workspace tile) on the right.
- **Legacy:** [_board-description-modal.scss](../../frontend/src/assets/styles/cmps/modal/_board-description-modal.scss).
- **Visual contract:** `850 × 550px` (`max-w 95vw`, `max-h 90vh`), `border-radius: 8px`, shadow `1px 0 20px black`. Right pane bg `--color-surface-info`. Description blockquote uses inline-editable [§2.1](#21-inline-editable-title-blockquote-pattern) pattern.
- **Lands in:** [05](05-workspaces-boards.md) or [06](06-groups-tasks-table.md) (whichever ships board description editing).
- **Fidelity bar:** `match`.

### 3.7 `CreateBoardModal` (centered)

- **Legacy:** [_create-board-modal.scss](../../frontend/src/assets/styles/cmps/modal/_create-board-modal.scss).
- **Visual contract:** `width 500px`, padding `16px 32px 32px`, `border-radius: 8px`, shadow `--shadow-modal`. H1 `32px / 500`, H3 `14px / 400`. Form input full-width, `border-radius: 4px`, `1px solid --color-border`, height `40px`.
- **Lands in:** [05](05-workspaces-boards.md).
- **Fidelity bar:** `match`.

### 3.8 `MemberModal` / `InviteModal`

- **Legacy:** [_member-modal.scss](../../frontend/src/assets/styles/cmps/modal/_member-modal.scss).
- **Visual contract:** `width 360px` desktop / `250px` mobile. Member chips in `taskMembers`: padding `4px 8px`, bg `--color-chip-member`, radius `8px`, with avatar `22 × 22`. Search row: padding `4px`, width `320px`, radius `8px`, `2px` border `--color-border-strong`.
- **Lands in:** [05](05-workspaces-boards.md).
- **Fidelity bar:** `match`.

### 3.9 `BulkActionBar` (floating)

- **What:** the floating bottom-aligned action bar that appears when ≥1 task is selected.
- **Legacy:** `modal/task-tools-modal.jsx` + [_task-tools-modal.scss](../../frontend/src/assets/styles/cmps/modal/_task-tools-modal.scss).
- **Visual contract:**
  - `position: fixed; bottom: 35px; height: 63px; width: 60%`. Inset positions left/right roughly center it.
  - Bg white, `border-radius: 5px`, `box-shadow: --shadow-bulk-bar`.
  - Left section: count tile width `63px`, bg `--color-primary`, white text, `font-size: 24px`, top/bottom-left corners rounded.
  - Middle: task info, padding `0 20px`, `font-size: 20px`, group color shown at `font-size: 10px`.
  - Right: action buttons (`Duplicate`, `Export`, `Move`, `Delete`...) — column layout, glyph 18px in `--color-fg-muted`, label 12px. Hover glyph color `--color-primary`.
  - Close button: width `63px`, `2px` left border `--color-shadow-card`. Glyph 26px black.
  - Slide-in animation: `opacity + transform` over `--motion-fast`.
- **Lands in:** [06](06-groups-tasks-table.md).
- **Fidelity bar:** `must-match`.

### 3.10 Add-column / Add-group / Filter-member modals

Inherit the [MenuModal recipe](#32-menumodal-recipe-mixin). Add-column is a flex-wrap grid (240px wide, 120px cells). Filter-member is a 400px panel with circular member avatars (30px) where active members get a `--color-card-selected` ring background. — All `match` fidelity.

---

## 4. Comments & activity

### 4.1 `CommentList` & `CommentItem`

- **Legacy:** `task/comment-preview.jsx` + [_comment-preview.scss](../../frontend/src/assets/styles/cmps/_comment-preview.scss).
- **Visual contract:**
  - Item: `border-radius: 4px`, `1px` border `--color-border-strong`, padding `16px`, margin-bottom `16px`.
  - Header: bottom-padding `8px`, `font-size: 14px`, color `--color-fg-muted`.
    - Left: avatar (26px), name in `--color-fg`, `font-size: 16px`, gap `8px`.
    - Right: timestamp + overflow menu glyph (24×24 hover wash to `--color-surface-hover`).
  - Body `<p>`: padding `0 16px 16px 16px`, max-width `540px`, word-wrap.
  - Cancel button: white bg, `--color-fg` text, `height: 32px`, `border-radius: 4px`, padding `4px 8px`. Hover bg `--color-surface-hover`.
- **Interaction:** edit/delete/react/reply per item. Edited shows "edited" tag. Deleted leaves placeholder.
- **Lands in:** [09](09-comments-activity.md).
- **Fidelity bar:** `must-match`.

### 4.2 `ActivityList` & `ActivityItem`

- **Legacy:** `activity-preview.jsx` + [_activity-preview.scss](../../frontend/src/assets/styles/cmps/_activity-preview.scss).
- **Visual contract:**
  - Row: padding `8px 0`, `1px` bottom border `--color-shadow-card`, margin `0 25px`, gap `5%`, font-size `16px`, height `60px`.
  - Avatar 30×30. Time-title col `200px` (mobile `100px`, font 12px).
  - From-to col: 200px, label spans width 90px (mobile 40px, height 30px, font 10px), arrow icon 35px in `--color-label-gray`. Labels use the status-color bg with white text, `border-radius: 4px`.
- **Lands in:** [09](09-comments-activity.md).
- **Fidelity bar:** `must-match`.

---

## 5. ~~Marketing components~~ — REMOVED

`<GetStartedButton />`, `<HomeTeaser />`, `<HomeScreenshot />` and the rest of the legacy `cmps/home/` and `cmps/custom/` files are not ported. The corresponding tokens (brand-violet, home gradients, CTA glow shadow) were dropped from [`design-system.md`](design-system.md). Per [00-overview.md](00-overview.md), the only public surface is Google sign-in.

---

## 6. Auth

### 6.1 `LoginSignup` form

- **Legacy:** `pages/login-signup.jsx` + [_login-signup.scss](../../frontend/src/assets/styles/views/_login-signup.scss).
- **Visual contract:**
  - Page wash `--color-surface-auth` (`#f7f7f7`). Header bar `height: 65px`, `1px` bottom border `#e0e0e0`.
  - Form container centered, padding-top 40px. H1 40px / 100 weight in `#333`.
  - Inputs `width: 328px`, `border-radius: 4px`, `1px solid #ccc`, padding `6px 12px`, font-size 16px, margin-bottom 16px.
  - Primary button: `width: 328px`, `border-radius: 4px`, font 18px, bg `--color-primary`, white text.
  - Google button: bordered `1px solid #c5c7d0`, padding `12px 16px`, gap `8px`, radius `4px`, white bg, label `font-size: 14px`.
  - Split-line: 200px wide separators with `0.5px` border `#c5c7d0`, gap `16px`.
  - "Sign up" link: color `#0fa2e2`, transparent bg, font-size 16px.
- **Lands in:** [03](03-auth.md).
- **Fidelity bar:** `match`. (We're swapping Google-only for Google + email/password + magic link, so the form structure changes; visual chrome stays.)

### 6.2 `Logo`

- **Legacy:** `cmps/logo.jsx` + [_logo.scss](../../frontend/src/assets/styles/cmps/_logo.scss).
- **Visual contract:** PNG icon 18px (normal+ 20px) + word-mark "donezo" at 20px (normal+ 24px), `font-weight: 700`, color black. Gap `7px`.
- **Lands in:** [01](01-foundation.md). Convert PNG → SVG at first opportunity.
- **Fidelity bar:** `must-match`.

---

## 7. Kanban view

### 7.1 `KanbanBoard` lanes & cards

- **Legacy:** `kanban/group-list-kanban.jsx` + [_group-list-kanban.scss](../../frontend/src/assets/styles/cmps/kanban/_group-list-kanban.scss), `_group-preview-kanban.scss`, `_task-list-kanban.scss`, `_task-preview-kanban.scss`.
- **Visual contract:**
  - Lane (`group-preview-kanban`): width `260px`, bg `--color-surface-rail`, header `44px` tall, white text on group color, top corners `8px` rounded.
  - Card (`task-container`): bg white, `border-radius: 4px`, `box-shadow: --shadow-card`, font 13px, margin-bottom 8px. Inner padding 8px, gap 8px.
  - Card title row: 36px tall, gap 4px, with chat icon right (24px). Comment count badge same as table (`14×13` circle, bg `--color-primary`).
  - Card content area: stacked picker rows, each 36px tall with bg `--color-surface-info` (`#f5f6f8`).
  - Lane container max-height `410px`, padding-left `38px`, gap `30px`, flex-wrap.
- **Interaction:** drag a card between lanes → updates the group-by cell. Drag within lane → updates `task.position`.
- **Lands in:** [12](12-alternate-views.md).
- **Fidelity bar:** `match` (the Kanban port is the loosest area; legacy code path is technically not even routed in JSX).

---

## 8. Empty states & loaders

### 8.1 `Loader`

- **Legacy:** `loader.jsx` + [_loader.scss](../../frontend/src/assets/styles/cmps/_loader.scss). Centered `loader.gif`.
- **Replace with:** `<Skeleton />` (shadcn) for layouts; spinner only for explicit "we don't know how long" cases (file uploads).
- **Lands in:** [01](01-foundation.md) for primitives; populated in [14](14-mobile-a11y-polish.md).
- **Fidelity bar:** `inspired`.

### 8.2 `LastViewed`

- **Legacy:** `last-viewed.jsx` + [_last-viewed.scss](../../frontend/src/assets/styles/cmps/_last-viewed.scss). Padding `32px 16px`, member info row gap 8px, avatar 26px.
- **Lands in:** [05](05-workspaces-boards.md) (workspace landing page).
- **Fidelity bar:** `match`.

### 8.3 Favorites empty-state

- **Legacy:** workspace-sidebar `.favorites-empty`. 80px star icon + centered text, font 15px, line-height 1.5.
- **Lands in:** [05](05-workspaces-boards.md).
- **Fidelity bar:** `match`.

---

## 9. Component → epic crosswalk

A quick lookup of which epic owns which component.

| Component / pattern | Epic |
|---|---|
| Tokens, fonts, scrollbar, `<MenuList />`, `<Skeleton />`, `<Logo />` | [01](01-foundation.md) |
| `<LoginSignup />` form, marketing logo header | [03](03-auth.md) |
| `<MainSidebar />`, `<WorkspaceSidebar />`, `<BoardHeader />` skeleton, `<CreateBoardModal />`, `<MemberModal />`, `<InviteModal />`, `<BoardDescriptionModal />`, `<LastViewed />`, favorites empty-state | [05](05-workspaces-boards.md) |
| Inline-editable title pattern (board / group / task), `<GroupHeader />`, `<TaskRow />`, `<BulkActionBar />`, group color stripe + `<ColorPalette />`, group-menu / task-menu / add-group modals, "+ New Item" split-button skeleton | [06](06-groups-tasks-table.md) |
| All cell types (`Status`, `Priority`, `Person`, `Date`, `Number`, `Checkbox`, `Text`, `Long-text`, `Email`, `Phone`, `Country`, `Link`, `Tags`, `Rating`, `Currency`, `Vote`, `Week`, `Location`, `Formula`, `UpdatedBy`, `CreatedBy`, `CreatedAt`), `<StatusLabelEditor />`, `<AddColumnModal />`, column header dropdown, group footer aggregations | [07](07-column-system.md) |
| `<CommentList />`, `<CommentItem />`, `<ActivityList />`, `<ActivityItem />`, `<TaskDrawer />` shell + Updates / Activity tabs | [09](09-comments-activity.md) |
| `<FileCell />`, `<TaskDrawer />` Files tab | [10](10-attachments.md) |
| `<BoardFilter />` toolbar (`Filter`, `Sort`, `Hide`, `Group`, `Search` controls), saved-views tabs | [11](11-filtering-views.md) |
| `<KanbanBoard />`, `<CalendarView />`, `<TimelineView />`, `<Dashboard />`, `<FormView />` and their per-view chrome (kanban card style, calendar agenda, timeline bars, dashboard widgets, form layout) | [12](12-alternate-views.md) |
| `<NotificationBell />`, `<NotificationCenter />`, email templates | [13](13-notifications.md) |
| Dark mode token overrides, `<EmptyState />`, mobile drawer + bottom-bar variants of `<MainSidebar />`/`<WorkspaceSidebar />`, motion-reduce wrappers | [14](14-mobile-a11y-polish.md) |

---

## 10. Open questions

- **Mobile bottom-bar parity.** Legacy mobile mode for `<MainSidebar />` is non-trivial (fixed-bottom row, hidden tools, hamburger). Most of this lands in [14](14-mobile-a11y-polish.md), but the *desktop* version in [05](05-workspaces-boards.md) needs to leave room for it (component contract, not just CSS).
- **Kanban code path.** Legacy Kanban is implemented but commented out of routing ([audit/03-frontend.md:32](../audit/03-frontend.md)). We're rebuilding from the SCSS + JSX, but treat any inferred behavior as design-by-archaeology.
- **Custom date/time picker.** Legacy uses `react-datepicker` (chunk of CSS we'd inherit); new app should use Base UI's date primitives styled to the legacy chrome. Defer details to [07](07-column-system.md) cell spec.
- **Status fold pixel-precise port.** The diagonal fold on hover is the most visually distinctive single moment in the app. Consider explicitly screenshotting it (light mode + dark mode) and saving to `docs/conversion-plan/_assets/` once produced, so executors don't drift.
