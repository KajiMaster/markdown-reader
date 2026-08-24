<p align="center">
  <img src="src-tauri/icons/128x128.png" width="64" height="64" alt="md-read icon">
</p>

<h1 align="center">md-read</h1>

<p align="center">A lightweight, cross-platform Markdown viewer/editor.</p>

`md-read /path/to/file.md &` opens a window showing the **rendered** document — no raw
tags. The rendered view is editable in place: <kbd>Ctrl</kbd>+<kbd>S</kbd> saves back to the
same file, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> saves as. That's the whole app —
no menus beyond a single toolbar, no vault, no sync, no plugins.

Supports CommonMark + GFM: tables, task lists, strikethrough, autolinks, footnotes. Not in
scope: Obsidian wikilinks/callouts, math, mermaid, front-matter rendering.

## Install

Every [release](https://github.com/KajiMaster/markdown-reader/releases) has installers for
Linux, Windows, and macOS. **Windows and macOS builds are unsigned** (no paid code-signing
certificate) — expect a first-run SmartScreen ("More info" → "Run anyway") or Gatekeeper
("Open Anyway" in System Settings → Privacy & Security) warning. That's expected for an
unsigned open-source build, not a sign anything's wrong.

**Linux (x86_64):**

```sh
curl -fsSL https://raw.githubusercontent.com/KajiMaster/markdown-reader/main/install.sh | sh
```

Installs to `~/.local/bin/md-read` with a desktop entry, no root required. Native `.deb`
and `.rpm` packages, plus a standalone `.AppImage`, are also attached to every release.

**Arch Linux:** an AUR package (`md-read-bin`) is provided in [`aur/`](aur/) — see
[`aur/README.md`](aur/README.md) for publishing it, or build it locally with `makepkg -si`.

**Windows 11:** download and run the `.msi` or `.exe` (NSIS) installer from the latest
release.

**macOS:** download the `.dmg` from the latest release, drag `md-read` into Applications.
The build is a universal binary (Intel + Apple Silicon).

**From source:** see [Development](#development) below.

## Development

Requires Node.js and Rust (see [Tauri's prerequisites](https://tauri.app/start/prerequisites/)).

```sh
npm install
npm run tauri dev    # run the app
npm test              # vitest
./verify.sh           # tests + build + rust check — the mechanical done-check
```

The whole Markdown pipeline (parse → render, and render → Markdown for saving) lives in
`src/md.ts` and is covered by `tests/fixtures/all-constructs.md`. Read `CLAUDE.md` before
making changes.

## Contributing

Issues and PRs are welcome. Keep changes scoped and add fixture coverage in
`tests/fixtures/all-constructs.md` for any new Markdown construct.

## License

[MIT](LICENSE)
