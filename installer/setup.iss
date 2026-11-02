; AeroGraph Inno Setup Script
; Builds self-contained, per-user setup installer for Falcon BMS pilots
; Single executable output: AeroGraph_Setup_v{#MyAppVersion}.exe

#define MyAppName "AeroGraph"
#define MyAppVersion "0.2.1"
#define MyAppPublisher "yagiziskirik"
#define MyAppURL "https://github.com/yagiziskirik/AeroGraph"
#define MyAppExeName "AeroGraph.exe"

[Setup]
AppId={{5D20C92F-8BE5-40D9-9231-15B2AE4A5D98}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}/issues
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={localappdata}\Programs\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=output
OutputBaseFilename=AeroGraph_Setup_v{#MyAppVersion}
SetupIconFile=..\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern

; Mutex and process detection
AppMutex=AeroGraph_SingleInstance_Mutex
CloseApplications=yes
CloseApplicationsFilter={#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "autostart"; Description: "Launch AeroGraph automatically when Windows starts"; GroupDescription: "Windows Integration:"; Flags: unchecked

[Dirs]
Name: "{app}\assets\images"
Name: "{app}\assets\work"

[Files]
; Main Executable
Source: "..\target\release\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

; Icons
Source: "..\icon.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\icon.png"; DestDir: "{app}"; Flags: ignoreversion

; Core Assets (Binaries, Briefings, Charts, Data, Profiles, Sounds, Custom checklists)
Source: "..\assets\*"; DestDir: "{app}\assets"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "work\*,images\*.png"

; POH Flight Reference Notes
Source: "..\notes\*"; DestDir: "{app}\notes"; Flags: ignoreversion recursesubdirs createallsubdirs

; Documentation and License
Source: "..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion; DestName: "LICENSE.txt"
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon.ico"; Tasks: desktopicon

[Registry]
; Optional Auto-Start with Windows
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "AeroGraph"; ValueData: """{app}\{#MyAppExeName}"""; Tasks: autostart; Flags: uninsdeletevalue

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
// Helper function to restore stock Falcon BMS F-16 textures from official BMS backup
procedure RestoreStockTextures(BmsDir: String);
var
  BackupDir, KoreaDir: String;
  I: Integer;
  FileName: String;
begin
  BackupDir := AddBackslash(BmsDir) + 'Docs\07 Kneeboard Templates\F-16\DDS_Backup\';
  KoreaDir := AddBackslash(BmsDir) + 'Data\Terrdata\Objects\KoreaObj\';
  
  if DirExists(BackupDir) and DirExists(KoreaDir) then
  begin
    for I := 7982 to 7997 do
    begin
      FileName := IntToStr(I) + '.dds';
      if FileExists(BackupDir + FileName) then
      begin
        CopyFile(BackupDir + FileName, KoreaDir + FileName, False);
      end;
    end;
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  BmsDir: String;
  KeepConfig: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    // 1. Prompt whether to keep or remove user configuration and custom notes
    KeepConfig := MsgBox('Would you like to keep your custom kneeboards.json and settings?' #13#10 #13#10 +
                         'Click Yes to keep your configuration for future installs, or No to completely remove them.',
                         mbConfirmation, MB_YESNO or MB_DEFBUTTON1);
    if KeepConfig = IDNO then
    begin
      // Delete user config and cache in %APPDATA%\ygz\AeroGraph
      DelTree(ExpandConstant('{userappdata}\ygz\AeroGraph'), True, True, True);
      // Delete local runtime files
      DeleteFile(ExpandConstant('{app}\kneeboards.json'));
      DelTree(ExpandConstant('{app}\assets\images'), True, True, True);
      DelTree(ExpandConstant('{app}\assets\work'), True, True, True);
    end;

    // 2. Check if Falcon BMS is installed and prompt to restore stock kneeboard textures
    if RegQueryStringValue(HKEY_LOCAL_MACHINE, 'SOFTWARE\WOW6432Node\Benchmark Sims\Falcon BMS 4.38', 'baseDir', BmsDir) then
    begin
      if DirExists(AddBackslash(BmsDir) + 'Docs\07 Kneeboard Templates\F-16\DDS_Backup') then
      begin
        if MsgBox('Falcon BMS installation detected.' #13#10 #13#10 +
                  'Would you like to restore the stock original F-16 kneeboard textures from the official Falcon BMS backup?',
                  mbConfirmation, MB_YESNO or MB_DEFBUTTON1) = IDYES then
        begin
          RestoreStockTextures(BmsDir);
        end;
      end;
    end;
  end;
end;
