# Canvas Exporter Installers

This folder contains installer assets for the Photoshop JSX script version.

The installed menu path is:

```text
File > Scripts > Canvas Exporter
```

Photoshop must be restarted after installation.

## macOS

Build a local `.pkg` installer:

```sh
./installer/mac/build-pkg.sh 1.0.0
```

Output:

```text
dist/Canvas Exporter Installer-1.0.0.pkg
```

The package stores a support copy at:

```text
/Library/Application Support/Canvas Exporter/Canvas Exporter.jsx
```

During installation it copies the script into every detected Photoshop scripts folder under:

```text
/Applications/Adobe Photoshop*/Presets/Scripts/
```

## Windows

Build an `.exe` installer with Inno Setup on Windows:

```text
installer\windows\CanvasExporter.iss
```

Output:

```text
dist\Canvas Exporter Setup-1.0.0.exe
```

The installer copies the script into every detected Photoshop scripts folder under:

```text
C:\Program Files\Adobe\Adobe Photoshop*\Presets\Scripts\
C:\Program Files (x86)\Adobe\Adobe Photoshop*\Presets\Scripts\
```

If Inno Setup is not available, users can right-click and run this fallback as administrator:

```text
installer\windows\Install Canvas Exporter.bat
```

Build a fallback zip on macOS/Linux:

```sh
./installer/windows/build-zip.sh 1.0.0
```
