# Page Composer P2 (Layout Mode) — Design

**Date:** 2026-06-18
**Status:** Approved (design) — pending spec review
**Program context:** Sub-project P2 of the page-composer program (see
[P1 spec](2026-06-18-page-composer-p1-design.md)). P1 shipped the foundation +
Content mode (edit existing blocks in place, draft↔publish). P2 adds **Layout mode**:
build a page's structure — add, delete, drag-reorder blocks, and pick works.

## How this measures against top-of-the-line CMSs

Block-level add / delete / drag-reorder + a block palette + a works (relation) picker
is the standard Layout layer in Sanity, WordPress Gutenberg, Editor.js, Builder.io,
and (in practice) Webflow/Framer. The curated single-column block stack — chosen over
a free-form canvas — is the same model those tools run on. P2 is therefore the correct,
standard next layer, appropriate for a design-minded clientele.

What lies **beyond** P2 toward true Webflow/Framer tier (all additive on this
foundation, sequenced after): **columns / nested sections** (the biggest design-control
upgrade — natural P5), **per-breakpoint responsive controls**, an **inline rich-text
toolbar** (Content-mode polish), and **undo/redo**. None block P2.

## Goal

Enable the currently-disabled **Layout** toggle in the editor mode bar so a superadmin
can add a block (from a palette), delete a block, drag to reorder, and choose the
artworks + column count for a works-grid block — then Save/Publish via the existing P1
flow. No new persistence.

## Resolved decisions (from brainstorming)

1. **Server-fragment rendering** (not client JS templates, not a Preact rewrite): adding
   a block fetches its HTML from a server **partial** that renders through the *same*
   `BlockRenderer`. Astro components stay the single source of markup; the island stays
   vanilla. One network round-trip per add (acceptable).
2. **Drag-reorder via SortableJS** (new ~14KB client-only dependency) — smooth, touch-
   capable, battle-tested, vs. the rougher native HTML5 DnD.

## Architecture

### ① Uniform editable wrapper — `src/components/blocks/BlockRenderer.astro`
Add an optional `editable` boolean prop. When `true`, wrap each block:
```astro
<div class="cb-block" data-block-id={b.id} data-block-type={b.type}><!-- block --></div>
```
When `false`/absent (the **public** route `/p/[slug]`), output is **unchanged** from P1
(no wrapper). The editor page and the render partial pass `editable={true}`. This wrapper
is what SortableJS reorders and what the island's per-block toolbar attaches to. *(Also
resolves the P1 carry-forward: a works-grid block is now identifiable via its wrapper.)*

### ② Server-fragment partial — `src/pages/admin/pages/render-block.astro`
`export const partial = true; export const prerender = false;` Gated to `super_admin`
(under `/admin`, plus an explicit role check). Reads `type` and `id` from query params,
builds a single default block via `normalizeBlocks([{ id, type, props: {} }])`, and
renders `<BlockRenderer editable={true} blocks={[block]} />` — returning just the block
fragment (no document/layout). The island fetches this and inserts the node.
*Load-bearing mechanism — the plan verifies a partial returns a clean fragment first.*

### ③ Pure block-array ops — `src/lib/blocks.ts` (+ tests)
Add pure, unit-tested helpers (no I/O):
- `insertBlockAt(blocks: Block[], block: Block, index: number): Block[]`
- `removeBlock(blocks: Block[], id: string): Block[]`
- `reorderByIds(blocks: Block[], orderedIds: string[]): Block[]` — reorders to match the
  given id sequence (the order SortableJS reads from the DOM); ignores unknown ids and
  appends any block whose id is missing from the list (defensive).
- `defaultBlock(type: BlockType, id: string): Block` (wraps `normalizeBlocks` for one
  block; the island uses it so new-block defaults come from the single source).
All return new arrays (immutable), clamp out-of-range indices, and no-op on unknown id.

### ④ Editor island → Layout mode — `src/scripts/composer.ts` + `composer-layout.ts`
Split the island so files stay focused: `composer.ts` keeps the shell (mode bar, shared
`state`, Content mode, Save/Publish from P1) and imports `composer-layout.ts` for
Layout-mode wiring. The shared `state: Block[]` and a `byId` map are passed in.
- **Enable** the `Layout` mode button (was disabled in P1). Switching modes toggles which
  chrome is visible; **Preview** hides all chrome (P1 behavior, extended to Layout).
- **Per-block toolbar** (injected onto each `.cb-block` on hover in Layout mode):
  `☰` drag-handle · `＋` add-below · `✖` delete.
- **Add:** `＋` (and a global "＋ Add block" at the page end) opens a small menu of the 7
  block types. Choosing one → `defaultBlock(type, uuid)` → `insertBlockAt(state,…)` →
  fetch its fragment from ② → insert the node at that position.
- **Reorder:** initialize **SortableJS** on the blocks container with `handle: '.cb-drag'`;
  on `onEnd`, read the DOM's `data-block-id` sequence and `reorderByIds(state, ids)`.
- **Delete:** remove the node + `removeBlock(state, id)`.

### ⑤ Works-picker — `src/pages/admin/pages/artworks.json.ts` + island modal
- New `super_admin` JSON endpoint returns `[{ id, title, artistName }]` (via the existing
  `getArtworks()` seam).
- In Layout mode, clicking a `worksGrid` block opens a modal: a checkbox list of all
  artworks (current `workIds` pre-checked) + a column selector (2/3/4). **Apply** updates
  that block's `props.workIds` (selection order = list/catalogue order) and `props.cols`
  in `state`, then re-renders just that block by fetching ② with the new props and
  replacing the node. *(Reordering works within the grid is deferred; catalogue order is
  the P2 behavior.)*

### ⑥ Persistence — unchanged
Every Layout action mutates the in-memory `state` array. **Save** (draft) / **Publish**
(live) use the P1 `/admin/pages/save` endpoint as-is. Public renders `published_blocks`
only — structural drafts never leak.

### ⑦ Styles — `src/styles/admin.css` (append)
`.cb-block` hover outline; the per-block toolbar + drag-handle; the add-block menu; the
works-picker modal. Editing chrome must not appear on the public route (no `.cb-block`
there).

## Dependency
Add `sortablejs` (~14KB, client-only) to `package.json`, imported in the island bundle.

## Error handling & edge cases
- Render partial: unknown `type` → 400; the island only sends the 7 known types.
- Add/delete/reorder operate purely on `state` + DOM; `normalizeBlocks` on Save guards any
  malformed result. Deleting the last block leaves an empty page (allowed).
- Works-picker with zero selected → `workIds: []` → the grid renders empty (allowed).
- SortableJS unavailable / JS error → Layout chrome simply doesn't mount; Content mode and
  Save/Publish still work (graceful degradation).
- All new endpoints re-check `super_admin` (defense-in-depth atop middleware).

## Testing
- **Unit** (`src/lib/blocks.test.ts`): `insertBlockAt`, `removeBlock`, `reorderByIds`,
  `defaultBlock` — order, immutability, index clamping, unknown-id no-op.
- **e2e** (`scripts/e2e-composer-layout.mjs`, Playwright): sign in → enter Layout mode →
  add a block via the palette → reorder via drag (or programmatic Sortable move) → delete a
  block → **Save** (public unchanged) → **Publish** → assert the new block structure is
  live on `/p/studio-demo`. Plus: the render-block partial and artworks endpoint reject a
  non-super_admin.

## Code touch points
- `src/components/blocks/BlockRenderer.astro` — optional `editable` wrapper.
- `src/pages/admin/pages/[slug].astro` — pass `editable={true}`.
- `src/pages/p/[slug].astro` — confirm it passes no `editable` (stays clean). (no change expected)
- `src/pages/admin/pages/render-block.astro` — new partial.
- `src/pages/admin/pages/artworks.json.ts` — new works endpoint.
- `src/lib/blocks.ts` (+ `.test.ts`) — pure array ops + `defaultBlock`.
- `src/scripts/composer.ts` + new `src/scripts/composer-layout.ts` — Layout wiring.
- `src/styles/admin.css` — Layout-mode styles.
- `package.json` — `sortablejs`.

## Verification checklist
- Public `/p/[slug]` HTML has **no** `.cb-block` wrappers (output unchanged from P1).
- Editor: Layout toggle active; hovering a block shows the toolbar; add-menu lists 7 types.
- Add inserts a real rendered block at the chosen position; delete removes it; drag reorders.
- Works-picker changes the grid's works + columns and re-renders that block.
- Save keeps public unchanged; Publish pushes the new structure live.
- Non-super_admin is rejected by the render-block partial and artworks endpoint.
- Unit + e2e green; production build passes.

## Out of scope (P2)
- **Columns / nested sections** (P5 — the key next design-control upgrade).
- Type mode (P3), Color mode (P4).
- Per-breakpoint responsive controls, inline rich-text toolbar, undo/redo.
- Page-create-from-UI; migrating the real homepage/About onto the composer.
- Reordering works *within* a works-grid (catalogue order only in P2).

## Roadmap to true top-of-the-line (recorded for context)
P2 Layout → **P5 columns/nested sections** → P3 Type → P4 Color → per-breakpoint
responsive → inline rich-text toolbar → undo/redo → migrate real pages. Each remains its
own spec → plan → build.
