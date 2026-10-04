# markdown-reader (`md-read`)

Lightweight cross-platform Markdown viewer/editor. Tauri v2 (Rust glue only) + TypeScript
frontend (Vite) + Milkdown WYSIWYG editor on a unified/remark pipeline. Tested on Arch/KDE.

## Product contract
- `md-read /path/file.md &` opens a window showing the RENDERED document (no raw tags).
- The rendered view is editable in place; Ctrl+S saves back to the same path, Ctrl+Shift+S = save-as.
- Minimal, fast, no menus beyond what a single toolbar needs. No plugins, no vault, no sync.
- @claude comments (v0.6): stored IN the .md as `<!-- @claude ID: … -->` … `<!-- /@claude ID -->`
  HTML comments, rendered as chips + a side panel, never as raw tags. The app never calls an AI
  service; Claude Code edits the file and the app reloads it (polls the open file every 1.5 s,
  asks before overwriting unsaved edits).
- v1 markdown scope: CommonMark + GFM (tables, task lists, strikethrough, autolinks, footnotes).
  NOT in scope: Obsidian wikilinks/callouts, math, mermaid, front-matter rendering.

## Architecture
- `src/md.ts` — the ONE markdown pipeline (parse → mdast → html; mdast → markdown). The editor
  and the tests both use it, so what the tests prove is what the app renders.
- `src/main.ts` — window bootstrap: read argv path via Tauri command, mount editor, wire save.
  Every save writes `normalizeForSave(editor markdown)`, never Milkdown's raw output.
- `src/links.ts` — pure link resolution (href classification, relative paths, heading slugs).
  Ctrl/Cmd+Click follows a link; plain click edits.
- `src/comments.ts` — pure marker syntax (parse/serialize, list, Claude prompt).
  `src/comments-editor.ts` — ProseMirror ops (add/reply/resolve), chip view, range highlight.
  `src/comments-ui.ts` — side panel and new-comment box (DOM only).
- `skills/md-comments/SKILL.md` — Claude Code skill that answers the comments; keep its format
  section in sync with `src/comments.ts`.
- `docs/` — the static website (GitHub Pages, served from `main` → `/docs`).
- `src-tauri/src/lib.rs` — commands: `get_argv`, `read_file`, `write_file`. Nothing else.
- `tests/` — vitest. `tests/fixtures/all-constructs.md` is the canonical coverage file.
  `tests/editor.ts` runs real Milkdown headless (jsdom) so the editor → save path is tested.

## Commands
- `npm test` — vitest (headless; the loop's exit condition)
- `npm run build` — tsc + vite build
- `npm run tauri dev` / `npm run tauri build`
- `./verify.sh` — the mechanical done-check (tests + build [+ xvfb smoke when available])

## Releasing
Bump the version in `package.json`, `src-tauri/Cargo.toml` and `src-tauri/tauri.conf.json`
(plus the lockfiles), add a `CHANGELOG.md` entry, update the version shown in `docs/index.html`, merge to `main`, then push a `vX.Y.Z` tag.
`.github/workflows/release.yml` builds and publishes the installers. Update `aur/PKGBUILD`
(`pkgver`, checksum) after the release assets exist.

## Rules for autonomous loops
- Work ONLY on the task in `loop/PROMPT.md`. Do not refactor, rename, or "improve" outside it.
- Never edit `tests/fixtures/all-constructs.md` or weaken a test to make it pass.
- Commit small, on the task branch only. Never push to `main`.
- Tooling: TypeScript on Node; no new build steps; no packages younger than 14 days.
