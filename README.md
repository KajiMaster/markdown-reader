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
| 💬 in the margin, or <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd> | Start a Claude thread on the hovered/selected blocks |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> | Show / hide the threads panel |
| <kbd>F1</kbd> or the `?` button | About: version, keys, links |

The window title shows the file and its folder (`notes.md — ~/projects — md-read`), with a
`●` while there are unsaved edits.

A plain click on a link only places the cursor, so link text stays editable. On macOS use
<kbd>Cmd</kbd> instead of <kbd>Ctrl</kbd>.

Saving always writes Markdown through the same tested pipeline the app renders with
(`src/md.ts`), so a save never quietly changes `-` bullets to `*` or reformats tables.

## Argue with Claude about any passage

Hover a paragraph, heading, list or table and click the 💬 that appears in the right margin
(or select several blocks first, or press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>M</kbd>). Type a
question or a challenge: "is this claim defensible?", "tighten this", "you're wrong about X".

Claude answers in **that passage's own thread** in the side panel, usually within a few
seconds. Reply to keep going. If you ask for a change, Claude rewrites just that passage in
place; one <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes it. If you edit the passage while Claude is
thinking, it replies but doesn't overwrite your edit.

**How it works:** md-read runs your local [Claude Code](https://claude.com/claude-code) CLI
(`claude`) for each message, with all of Claude's tools turned off, so it can only answer; the
app applies any rewrite itself. It uses your own Claude Code login, and nothing runs unless you
send a message. Without Claude Code installed, threads still work as notes, and the
**Copy prompt for Claude** button or the bundled `/md-comments` skill can answer them later.

Threads are saved **in the Markdown file itself**, wrapped around the blocks they're about:

```md
<!-- @claude c1: is "fastest editor ever made" defensible?
claude: No. One benchmark against vim disproves it. I rewrote it to a claim you can back up. -->

md-read opens instantly and stays responsive on large files.

<!-- /@claude c1 -->
```

HTML comments are invisible on GitHub and in other Markdown renderers, and md-read hides them
too: a commented passage is just highlighted, with a 💬 badge in the margin (filled once Claude
has replied). Think of threads like tracked changes: they live in the file only while you're
working on a passage. **Accept & resolve** (or **Resolve all** in the panel) removes the markers
and keeps the text, so the file is plain Markdown again. Threads only reach disk when you save.

To answer every open thread at once from Claude Code, install the bundled skill and run
`/md-comments notes.md`:

```sh
mkdir -p ~/.claude/skills && cp -r skills/md-comments ~/.claude/skills/
```

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
