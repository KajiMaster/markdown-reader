<p align="center">
  <img src="src-tauri/icons/128x128.png" width="64" height="64" alt="md-read icon">
</p>

<h1 align="center">md-read</h1>

<p align="center">A lightweight, cross-platform Markdown viewer/editor.</p>

<p align="center"><a href="https://kajimaster.github.io/markdown-reader/">Website</a> · <a href="https://github.com/KajiMaster/markdown-reader/releases/latest">Download</a> · <a href="CHANGELOG.md">Changelog</a></p>

`md-read /path/to/file.md &` opens a window showing the **rendered** document — no raw
tags. The rendered view is editable in place: <kbd>Ctrl</kbd>+<kbd>S</kbd> saves back to the
same file, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> saves as. That's the whole app —
no menus beyond a single toolbar, no vault, no sync, no plugins.

Supports CommonMark + GFM: tables, task lists, strikethrough, autolinks, footnotes. Not in
scope: Obsidian wikilinks/callouts, math, mermaid, front-matter rendering.

## Keys

| Key | Does |
|---|---|
| <kbd>Ctrl</kbd>+<kbd>S</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> | Save / save as |
| <kbd>Ctrl</kbd>+<kbd>O</kbd> | Open another file |
| <kbd>Ctrl</kbd>+Click a link | Follow it: web links open in your browser, `#heading` links scroll, relative `.md` links open in the same window |
| <kbd>Ctrl</kbd>+<kbd>+</kbd> / <kbd>-</kbd> / <kbd>0</kbd> | Zoom in / out / reset |
| <kbd>Ctrl</kbd>+<kbd>P</kbd> | Print |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd> | Comment on the selected blocks (for Claude) |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> | Show / hide the comments panel |

A plain click on a link only places the cursor, so link text stays editable. On macOS use
<kbd>Cmd</kbd> instead of <kbd>Ctrl</kbd>.

Saving always writes Markdown through the same tested pipeline the app renders with
(`src/md.ts`), so a save never quietly changes `-` bullets to `*` or reformats tables.

## Ask Claude about part of a document

Select one or more paragraphs, press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd>, and type what
you want ("merge these", "is this claim right?"). The comment is saved **in the Markdown file
itself**, wrapped around the blocks it's about:

```md
<!-- @claude c1: merge these two paragraphs -->

First paragraph…

Second paragraph…

<!-- /@claude c1 -->
```

HTML comments are invisible on GitHub and in other Markdown renderers, so the file stays clean
everywhere else. In md-read they show as a 💬 chip with the commented blocks highlighted, and
every thread is listed in the side panel.

To get answers, click **Copy prompt for Claude** in the panel (it saves first) and paste the
prompt into [Claude Code](https://claude.com/claude-code). Claude edits the marked text and
either removes the markers (done) or adds a `claude: …` reply line to the thread. md-read
watches the file and reloads as soon as Claude saves, so you see the result live. If you have
unsaved edits at that moment, it asks before replacing anything.

Reply to a thread or **Resolve** it (removes the markers, keeps the text) from the panel.
md-read never calls an AI service itself: no API key, no network, no cost.

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
