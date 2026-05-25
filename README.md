# Filtered graph with linked notes

Extends Obsidian’s **global graph view** so filtered notes also show **outgoing linked notes** (neighbors by link depth).

## Usage

1. Enable the plugin in **Settings → Community plugins**.
2. Open the **global graph** (ribbon or Mod+G).
3. Open graph settings (gear) if the filter panel is collapsed.
4. At the bottom of **Filters**:
   - **Include linked notes** — show notes linked from matches (even without matching the search)
   - **Depth** (1–3) — outgoing link hops; disabled when the toggle is off

Both controls are disabled until you enter a **Search files** filter.

Set a **Search files** filter (e.g. `tag:#todos`), then turn on **Include linked notes** if you want neighbors shown. Matching notes always appear; linked notes up to the chosen depth appear only when the toggle is on (off by default).

**Empty search:** both controls are greyed out; no linked-notes expansion runs.

**Local graph:** unchanged; use Obsidian’s built-in local graph depth.

**Bookmarks:** graph bookmarks store **Include linked notes** and **Depth** per bookmark (via the same options blob as filters). Missing values use plugin defaults (toggle off, depth 1). Each open graph pane keeps its own settings.

**Plugin `data.json`:** `includeLinkedNotes` and `linkDepth` are **defaults only** (for new graphs and old bookmarks). Changing the toggle in the graph does not update `data.json`.

### Debug logging (bookmark race)

If a bookmark opens with the wrong toggle state, enable logging:

1. Open the plugin data file: **Settings → Community plugins →** your plugin folder → `data.json`
2. Add `"debugLogging": true`
3. Reload the plugin, reproduce the issue, then open **View → Developer tools → Console**
4. Filter by `filtered-graph` and share the log lines (especially `setOptions-payload`, `reconcile`, `tryBindLeaf:mount`)

## Development

```bash
npm install
npm run dev
```

Reload the plugin after building. See [SPIKE.md](./SPIKE.md) for internal API notes.
