# Changelog

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
