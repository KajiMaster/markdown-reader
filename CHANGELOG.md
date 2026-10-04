# Changelog

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
