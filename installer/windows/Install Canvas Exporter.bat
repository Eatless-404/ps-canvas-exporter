@echo off
setlocal enabledelayedexpansion

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Requesting administrator permission...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

set "SOURCE=%~dp0Canvas Exporter.jsx"
if not exist "%SOURCE%" set "SOURCE=%~dp0CanvasExporter.jsx"
if not exist "%SOURCE%" set "SOURCE=%~dp0..\..\CanvasExporter.jsx"
if not exist "%SOURCE%" (
  echo Cannot find CanvasExporter.jsx.
  echo Expected: %SOURCE%
  pause
  exit /b 1
)

set "INSTALLED=0"

for %%B in ("%ProgramFiles%\Adobe" "%ProgramFiles(x86)%\Adobe") do (
  if exist "%%~B" (
    for /d %%P in ("%%~B\Adobe Photoshop*") do (
      if exist "%%~P\Presets\Scripts" (
        copy /Y "%SOURCE%" "%%~P\Presets\Scripts\Canvas Exporter.jsx" >nul
        if !errorlevel! equ 0 (
          echo Installed to: %%~P\Presets\Scripts\Canvas Exporter.jsx
          set /a INSTALLED+=1
        ) else (
          echo Failed to install to: %%~P\Presets\Scripts
        )
      )
    )
  )
)

if "%INSTALLED%"=="0" (
  echo No Photoshop Scripts folder was found.
  echo Please run this installer as Administrator, or copy CanvasExporter.jsx manually.
  pause
  exit /b 1
)

echo.
echo Done. Restart Photoshop, then open File ^> Scripts ^> Canvas Exporter.
pause
