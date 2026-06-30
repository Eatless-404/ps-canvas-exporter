#!/bin/sh
set -eu
export COPYFILE_DISABLE=1

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="${1:-1.0.0}"
BUILD_DIR="$REPO_ROOT/build/macos-pkg"
SCRIPTS_DIR="$REPO_ROOT/installer/mac/scripts"
BUILD_SCRIPTS_DIR="$BUILD_DIR/scripts"
DIST_DIR="$REPO_ROOT/dist"
OUTPUT="$DIST_DIR/Canvas Exporter Installer-$VERSION.pkg"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_SCRIPTS_DIR" "$DIST_DIR"

cp "$SCRIPTS_DIR/postinstall" "$BUILD_SCRIPTS_DIR/postinstall"
cp "$REPO_ROOT/CanvasExporter.jsx" "$BUILD_SCRIPTS_DIR/Canvas Exporter.jsx"
chmod +x "$BUILD_SCRIPTS_DIR/postinstall"
xattr -cr "$BUILD_SCRIPTS_DIR" 2>/dev/null || true

pkgbuild \
  --nopayload \
  --scripts "$BUILD_SCRIPTS_DIR" \
  --identifier "com.canvasexporter.photoshop.script" \
  --version "$VERSION" \
  "$OUTPUT"

printf "Built %s\n" "$OUTPUT"
