#!/bin/sh
set -eu
export COPYFILE_DISABLE=1

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VERSION="${1:-1.0.0}"
BUILD_DIR="$REPO_ROOT/build/windows-zip"
PACKAGE_DIR="$BUILD_DIR/Canvas Exporter Windows Installer-$VERSION"
DIST_DIR="$REPO_ROOT/dist"
OUTPUT="$DIST_DIR/Canvas Exporter Windows Installer-$VERSION.zip"

rm -rf "$BUILD_DIR"
mkdir -p "$PACKAGE_DIR" "$DIST_DIR"

cp "$REPO_ROOT/CanvasExporter.jsx" "$PACKAGE_DIR/Canvas Exporter.jsx"
cp "$REPO_ROOT/installer/windows/Install Canvas Exporter.bat" "$PACKAGE_DIR/"
cp "$REPO_ROOT/installer/windows/CanvasExporter.iss" "$PACKAGE_DIR/"
xattr -cr "$PACKAGE_DIR" 2>/dev/null || true

rm -f "$OUTPUT"
cd "$BUILD_DIR"
zip -r -X "$OUTPUT" "Canvas Exporter Windows Installer-$VERSION"

printf "Built %s\n" "$OUTPUT"
