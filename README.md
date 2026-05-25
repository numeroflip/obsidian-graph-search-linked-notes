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

Set a **Search files** filter (e.g. `tag:#todos`). Matching notes appear, plus linked notes up to the chosen depth when the toggle is on.

**Empty search:** both controls are greyed out; no linked-notes expansion runs.

**Local graph:** unchanged; use Obsidian’s built-in local graph depth.

## Development

```bash
npm install
npm run dev
```

Reload the plugin after building. See [SPIKE.md](./SPIKE.md) for internal API notes.
