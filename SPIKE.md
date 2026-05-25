# Graph filter spike

Short spike to validate **approach B**: patch the global graph’s internal `dataEngine` so nodes linked from search matches appear without matching the search themselves.

## Findings (Obsidian 1.12.7 `app.js`)

| Piece | Internal name | Role |
|-------|---------------|------|
| Global graph view | `kJ`, view type `"graph"` | `leaf.view` from `getLeavesOfType("graph")` |
| Data engine | `xJ` | `view.dataEngine` — search, `fileFilter`, `render()` |
| Renderer | `AQ` | `view.renderer` — Pixi graph |
| Search → files | `setQuery` / `updateSearch` | Fills `fileFilter[path]` via matcher `BH` |
| Visibility | `render()` → inner callback | File shown if `fileFilter[path]` is truthy when `hasFilter` |

**Hook strategy:** wrap `dataEngine.render`, and before calling the original, merge outgoing neighbors (BFS on `metadataCache.resolvedLinks`) into `fileFilter`. Empty search → no-op (matches product rule).

Local graph depth uses `PQ()` with `localJumps`; global graph has no equivalent — we add it.

## Spike status

- [x] Inspect finds `dataEngine` with `fileFilter`, `filterOptions.search`
- [x] With non-empty search, patch shows linked neighbors
- [x] With empty search, graph unchanged
- [x] Patch approach validated in Obsidian

## Implementation steps

1. [x] **UI toggle + depth slider (1–3) in `.graph-controls`** — `LinkedNotesControlsSection` in graph filter panel; settings persist across sessions.
2. [x] Debounce on search / metadata changes
3. [ ] Optional: `obsidian-search` for reliable query evaluation
4. [ ] Test on mobile (same internals; UI injection may differ)

Spike commands were removed; the feature is always on when the global graph is open.
