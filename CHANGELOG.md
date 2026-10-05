# Changelog

## 0.7.1

- **No more visible comment tags.** The `💬 c1 · …` and `end c1` lines are gone from the
  rendered view. A commented passage is just highlighted, with a 💬 badge in the right margin
  (filled once Claude has replied); click it to open the thread.
- **Resolving is one click.** Threads where Claude replied offer **Accept & resolve**, and the
  panel has **Resolve all**. Resolving removes the markers, so the file is plain Markdown again.
- **Fixed:** pressing Backspace or Delete right next to a thread could merge your text into the
  hidden marker line, which hid that text inside an HTML comment. Marker lines now always stay
  separate.

## 0.7.0

- **A Claude thread on any passage.** Hover a paragraph, heading, list or table (or select
  several) and click the 💬 in the right margin. Write your question or challenge; Claude answers
  in that passage's own thread within seconds. Reply to keep arguing. When you ask for a change,
  Claude rewrites just that passage, and one Ctrl+Z undoes it. md-read runs your local Claude
  Code (`claude`) with every tool disabled, using your own login; the app applies edits itself.
- **About box.** The `?` button (or F1) shows the version, keys and links.
- **Fixed:** on Linux/Wayland the visible title bar kept saying "md-read" even though the
  window title had changed. It now shows the file and folder.

## 0.6.1

- **Window title shows the document.** The title is now `notes.md — ~/folder — md-read`, with a
  `●` in front while there are unsaved edits, so several open windows are easy to tell apart.

## 0.6.0

- **@claude comments.** Select blocks, press Ctrl+Alt+M, and leave a comment for Claude. It is
  stored in the Markdown file as an HTML comment (invisible in other renderers), shown as a
  chip with the commented blocks highlighted, and listed in a side panel where you can reply
  or resolve. **Copy prompt for Claude** hands the whole review to Claude Code.
- **`/md-comments` Claude Code skill** in `skills/md-comments/`: run `/md-comments file.md` to
  have Claude answer every open comment without copying a prompt.
- **Live reload.** When the open file changes on disk (e.g. Claude Code edits it), md-read
  reloads it. If you have unsaved edits, it asks first.
- **Fixed:** a freshly opened file no longer counts as having unsaved changes, so the Ctrl+O
  "discard changes?" prompt only appears when you've actually edited something.

## 0.5.0

- **Links work.** Ctrl/Cmd+Click follows a link: `https://` links open in your browser,
  `#heading` links scroll to the heading (GitHub-style slugs and `<a id>` anchors), and
  relative `.md` links open in the same window. A plain click still edits.
- **Saves keep your formatting.** Every save goes through the same tested Markdown pipeline
  the app renders with, so `-` bullets, table rules and other syntax no longer drift.

## 0.4.0

- Windows, macOS and RPM installers via the release build matrix.

## 0.3.0

- Remembers window size and position.

## 0.2.0

- Ctrl+O open, zoom, print, and an unsaved-changes guard.

## 0.1.0

- First release: rendered, editable Markdown with Ctrl+S save. Linux packaging, AUR package.
