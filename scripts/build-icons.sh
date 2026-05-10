#!/usr/bin/env bash
# Regenerate macOS app icons from src-tauri/icons/icon.svg.
# Run from valley project root: bash scripts/build-icons.sh
#
# Source SVG comes from the valley-design-system bundle (icon-1024-flat.svg).
# Renders the size set Tauri's bundle.icon list references plus the legacy
# files we keep around (64x64.png, icon.png, etc.) so a stale variant
# never ships next to a fresh one.

set -euo pipefail

ICON_DIR="src-tauri/icons"
SRC="$ICON_DIR/icon.svg"

if [[ ! -f "$SRC" ]]; then
  echo "missing $SRC — copy the flat-canonical SVG there first" >&2
  exit 1
fi
if ! command -v rsvg-convert >/dev/null; then
  echo "rsvg-convert not found — brew install librsvg" >&2
  exit 1
fi

render() {
  local size=$1 out=$2
  rsvg-convert -w "$size" -h "$size" "$SRC" -o "$ICON_DIR/$out"
}

render 16   icon_16.png
render 32   32x32.png
render 64   64x64.png
render 128  128x128.png
render 256  128x128@2x.png
render 256  icon_256.png
render 512  icon_512.png
render 1024 icon.png

# .icns via iconutil. The iconset names must match Apple's exact format.
ICONSET="$ICON_DIR/icon.iconset"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"
cp "$ICON_DIR/icon_16.png"     "$ICONSET/icon_16x16.png"
cp "$ICON_DIR/32x32.png"       "$ICONSET/icon_16x16@2x.png"
cp "$ICON_DIR/32x32.png"       "$ICONSET/icon_32x32.png"
cp "$ICON_DIR/64x64.png"       "$ICONSET/icon_32x32@2x.png"
cp "$ICON_DIR/128x128.png"     "$ICONSET/icon_128x128.png"
cp "$ICON_DIR/128x128@2x.png"  "$ICONSET/icon_128x128@2x.png"
cp "$ICON_DIR/icon_256.png"    "$ICONSET/icon_256x256.png"
cp "$ICON_DIR/icon_512.png"    "$ICONSET/icon_256x256@2x.png"
cp "$ICON_DIR/icon_512.png"    "$ICONSET/icon_512x512.png"
cp "$ICON_DIR/icon.png"        "$ICONSET/icon_512x512@2x.png"
iconutil -c icns "$ICONSET" -o "$ICON_DIR/icon.icns"
rm -rf "$ICONSET" "$ICON_DIR/icon_16.png" "$ICON_DIR/icon_256.png" "$ICON_DIR/icon_512.png"

echo "regenerated:"
ls -la "$ICON_DIR/icon.icns" "$ICON_DIR"/*.png | grep -v Square | grep -v StoreLogo
