#define AppName "Canvas Exporter"
#define AppVersion "1.0.0"
#define AppPublisher "Canvas Exporter"
#define AppId "{{BB453DD4-6AF7-4F4C-B32C-5835BF9B91B8}"

[Setup]
AppId={#AppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={commonappdata}\Canvas Exporter
DisableDirPage=yes
DisableProgramGroupPage=yes
OutputDir=..\..\dist
OutputBaseFilename=Canvas Exporter Setup-{#AppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayName={#AppName}

[Files]
Source: "..\..\CanvasExporter.jsx"; DestDir: "{app}"; DestName: "Canvas Exporter.jsx"; Flags: ignoreversion

[Code]
var
  InstallSummary: string;

procedure AddSummaryLine(Line: string);
begin
  if InstallSummary = '' then
    InstallSummary := Line
  else
    InstallSummary := InstallSummary + #13#10 + Line;
end;

function CopyScriptToPhotoshopDir(BaseDir: string): Integer;
var
  FindRec: TFindRec;
  ScriptsDir: string;
begin
  Result := 0;
  if FindFirst(BaseDir + '\Adobe Photoshop*', FindRec) then
  begin
    try
      repeat
        if (FindRec.Attributes and FILE_ATTRIBUTE_DIRECTORY) <> 0 then
        begin
          ScriptsDir := BaseDir + '\' + FindRec.Name + '\Presets\Scripts';
          if DirExists(ScriptsDir) then
          begin
            if FileCopy(ExpandConstant('{app}\Canvas Exporter.jsx'), ScriptsDir + '\Canvas Exporter.jsx', False) then
            begin
              Result := Result + 1;
              AddSummaryLine('Installed to: ' + ScriptsDir);
            end
            else
              AddSummaryLine('Failed to copy to: ' + ScriptsDir);
          end;
        end;
      until not FindNext(FindRec);
    finally
      FindClose(FindRec);
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Count: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    Count := 0;
    Count := Count + CopyScriptToPhotoshopDir(ExpandConstant('{pf}\Adobe'));
    Count := Count + CopyScriptToPhotoshopDir(ExpandConstant('{pf32}\Adobe'));

    if Count = 0 then
      AddSummaryLine('No Photoshop Scripts folder was found. The script was kept at: ' + ExpandConstant('{app}\Canvas Exporter.jsx'));
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpFinished then
  begin
    WizardForm.FinishedLabel.Caption :=
      'Canvas Exporter installation finished.' + #13#10 + #13#10 +
      InstallSummary + #13#10 + #13#10 +
      'Restart Photoshop, then open File > Scripts > Canvas Exporter.';
  end;
end;
