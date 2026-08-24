#!/usr/bin/env bash
# Installs the latest md-read release for Linux x86_64 into ~/.local/{bin,share}.
# Usage: curl -fsSL https://raw.githubusercontent.com/KajiMaster/markdown-reader/main/install.sh | sh
set -euo pipefail

REPO="KajiMaster/markdown-reader"

if [ "$(uname -s)" != "Linux" ] || [ "$(uname -m)" != "x86_64" ]; then
  echo "md-read's installer currently only supports Linux x86_64." >&2
  echo "See https://github.com/$REPO for building from source on other platforms." >&2
  exit 1
fi

echo "Fetching latest release..."
LATEST_JSON=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest")
TAG=$(printf '%s' "$LATEST_JSON" | grep -m1 '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')
if [ -z "$TAG" ]; then
  echo "Could not determine the latest release. Check https://github.com/$REPO/releases" >&2
  exit 1
fi

VERSION="${TAG#v}"
ASSET="md-read-${VERSION}-x86_64.tar.gz"
URL="https://github.com/$REPO/releases/download/$TAG/$ASSET"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "Downloading $ASSET..."
curl -fsSL "$URL" -o "$TMPDIR/$ASSET"
tar xzf "$TMPDIR/$ASSET" -C "$TMPDIR"

STAGE="$TMPDIR/md-read-${VERSION}-x86_64"
BIN_DIR="$HOME/.local/bin"
ICON_DIR="$HOME/.local/share/icons/hicolor/128x128/apps"
DESKTOP_DIR="$HOME/.local/share/applications"
mkdir -p "$BIN_DIR" "$ICON_DIR" "$DESKTOP_DIR"

install -m 755 "$STAGE/md-read" "$BIN_DIR/md-read"
install -m 644 "$STAGE/md-read.png" "$ICON_DIR/md-read.png"
sed "s|^Exec=.*|Exec=$BIN_DIR/md-read %f|" "$STAGE/md-read.desktop" > "$DESKTOP_DIR/md-read.desktop"
chmod 644 "$DESKTOP_DIR/md-read.desktop"

echo "Installed md-read $TAG to $BIN_DIR/md-read"

case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *)
    echo
    echo "$BIN_DIR is not on your PATH. Add this to your shell profile:"
    echo "  export PATH=\"$BIN_DIR:\$PATH\""
    ;;
esac

echo
echo "Run it with:  md-read /path/to/file.md &"
