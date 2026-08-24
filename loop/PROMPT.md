# Task: make `./verify.sh` exit 0 for markdown-reader

You are one iteration of an unattended build loop on a headless Linux seat (no display).
Read CLAUDE.md first. Then run `./verify.sh`; its output tells you what is still failing.

## Scope (fence — do not cross)
Implement ONLY what is needed for:
1. `src/md.ts`: `toHtml(md: string): string` and `toMarkdown(mdast): string` +
   `parse(md): Root` on a unified/remark pipeline with GFM + footnotes, so that every construct in
   `tests/fixtures/all-constructs.md` renders to the HTML the tests expect and round-trips
   (parse → stringify → parse yields an equivalent tree).
2. `src/main.ts`: on startup call the Tauri command `get_argv`; if a path is given, `read_file`
   it and mount a Milkdown (Crepe) editor showing the rendered document; Ctrl+S → `write_file`
   the editor's markdown to the same path; Ctrl+Shift+S → save-as via `@tauri-apps/plugin-dialog`.
3. `src-tauri/src/lib.rs`: the three commands (`get_argv`, `read_file`, `write_file`) and the
   dialog plugin registration. Binary name `md-read` (set `productName`/`mainBinaryName`).
4. Keep `npm run build` green.

Do NOT: touch `tests/fixtures/`, weaken or delete tests, add features beyond the contract
(themes, settings, menus, plugins, Obsidian syntax), reformat unrelated files, or bump
dependency majors. If something outside this scope blocks you, write it to
`loop/BLOCKERS.md` and stop — do not work around it by widening scope.

## Definition of done
`./verify.sh` exits 0. Nothing else counts.

## Working style
Small commits on the current branch with messages `md-read: <what>`. No pushes. When
`./verify.sh` passes, append a 5-line summary to `loop/HANDOFF.md` and exit.
