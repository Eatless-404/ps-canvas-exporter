# Photoshop Canvas Exporter

Export Photoshop layers or groups as transparent PNGs while preserving the original canvas size. It also supports slice-based layered export, so each layer/group can be exported inside a Photoshop Slice area.

## Features

- Export layers and groups as full-canvas PNG files.
- Export by Photoshop Slice areas.
- Keep each exported asset aligned to the original canvas or slice bounds.
- Hidden layers are shown but not selected by default.
- Choose a destination and name the output folder before export.
- Supports 1x, 2x, and 3x export scale.

## Script Version

Use `CanvasExporter.jsx` if you want the Photoshop menu workflow.

### Install

Copy `CanvasExporter.jsx` to Photoshop's Scripts folder.

macOS:

```text
/Applications/Adobe Photoshop 2025/Presets/Scripts/Canvas Exporter.jsx
```

Windows:

```text
C:\Program Files\Adobe\Adobe Photoshop 2025\Presets\Scripts\Canvas Exporter.jsx
```

Adjust the Photoshop version number if you use another version.

Restart Photoshop if the menu item does not appear.

### Open

In Photoshop:

```text
File -> Scripts -> Canvas Exporter
```

### Slice Export

1. Create Photoshop slices in the document.
2. Open `Canvas Exporter`.
3. Choose `按切片`.
4. Choose `全部切片` or a single slice.
5. Select the layers/groups to export.
6. Choose a destination folder and name the export folder.

## UXP Panel Version

This repository also includes an experimental UXP panel:

- `manifest.json`
- `index.html`
- `index.js`
- `icons/plugin-icon.png`

Load it with Adobe UXP Developer Tool by selecting `manifest.json`.

## Notes

- The JSX script uses Photoshop's internal slice descriptor to read user-generated slices.
- Slice names are normalized by vertical position as `切片 01`, `切片 02`, etc.
- Exported files are named with the document, slice, and layer/group names.

## License

MIT
