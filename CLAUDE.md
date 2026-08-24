# markdown-reader (`md-read`)

Lightweight cross-platform Markdown viewer/editor. Tauri v2 (Rust glue only) + TypeScript
frontend (Vite) + Milkdown WYSIWYG editor on a unified/remark pipeline. Tested on Arch/KDE.

## Product contract
- `md-read /path/file.md &` opens a window showing the RENDERED document (no raw tags).
- The rendered view is editable in place; Ctrl+S saves back to the same path, Ctrl+Shift+S = save-as.
- Minimal, fast, no menus beyond what a single toolbar needs. No plugins, no vault, no sync.
- v1 markdown scope: CommonMark + GFM (tables, task lists, strikethrough, autolinks, footnotes).
  NOT in scope: Obsidian wikilinks/callouts, math, mermaid, front-matter rendering.

## Architecture
- `src/md.ts` — the ONE markdown pipeline (parse → mdast → html; mdast → markdown). The editor
  and the tests both use it, so what the tests prove is what the app renders.
- `src/main.ts` — window bootstrap: read argv path via Tauri command, mount editor, wire save.
- `src-tauri/src/lib.rs` — commands: `get_argv`, `read_file`, `write_file`. Nothing else.
- `tests/` — vitest. `tests/fixtures/all-constructs.md` is the canonical coverage file.

## Commands
- `npm test` — vitest (headless; the loop's exit condition)
- `npm run build` — tsc + vite build
- `npm run tauri dev` / `npm run tauri build`
- `./verify.sh` — the mechanical done-check (tests + build [+ xvfb smoke when available])

## Rules for autonomous loops
- Work ONLY on the task in `loop/PROMPT.md`. Do not refactor, rename, or "improve" outside it.
- Never edit `tests/fixtures/all-constructs.md` or weaken a test to make it pass.
- Commit small, on the task branch only. Never push to `main`.
- Tooling: TypeScript on Node; no new build steps; no packages younger than 14 days.
