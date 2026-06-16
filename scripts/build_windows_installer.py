from __future__ import annotations

import shutil
import subprocess
import sys
import textwrap
from pathlib import Path

from build_exe import ROOT, convert_png_to_ico, main as build_exe


APP_NAME = "Launcher EVA"
APP_EXE = "LauncherEVA.exe"
APP_ID = "5E718CF4-41D8-4A9D-8A73-E0C8DA514C55"
VERSION = "1.1"


def find_inno_setup() -> str | None:
    candidates = [
        shutil.which("iscc"),
        shutil.which("ISCC"),
        r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        r"C:\Program Files\Inno Setup 6\ISCC.exe",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return str(candidate)
    return None


def build_iss(dist_dir: Path) -> Path:
    iss_path = dist_dir / "LauncherEVA_installer.iss"
    icon_path = convert_png_to_ico(ROOT / "Eva_icon.png") or ROOT / "Eva_icon.png"
    app_path = dist_dir / APP_EXE
    data_dir_name = "Launcher EVA"
    app_id_literal = "{{" + APP_ID + "}"

    iss_path.write_text(
        textwrap.dedent(
            f"""\
            #define MyAppName "{APP_NAME}"
            #define MyAppVersion "{VERSION}"
            #define MyAppPublisher "Launcher EVA"
            #define MyAppExeName "{APP_EXE}"
            #define MyAppDataDir "{data_dir_name}"

            [Setup]
            AppId={app_id_literal}
            AppName={{#MyAppName}}
            AppVersion={{#MyAppVersion}}
            AppPublisher={{#MyAppPublisher}}
            DefaultDirName={{autopf}}\\Launcher EVA
            DefaultGroupName={{#MyAppName}}
            DisableProgramGroupPage=yes
            OutputDir={dist_dir}
            OutputBaseFilename=LauncherEVA_Setup_{VERSION}
            Compression=lzma
            SolidCompression=yes
            WizardStyle=modern
            SetupIconFile={icon_path}
            UninstallDisplayIcon={{app}}\\{{#MyAppExeName}}
            ArchitecturesInstallIn64BitMode=x64compatible

            [Files]
            Source: "{app_path}"; DestDir: "{{app}}"; Flags: ignoreversion

            [Icons]
            Name: "{{group}}\\{{#MyAppName}}"; Filename: "{{app}}\\{{#MyAppExeName}}"
            Name: "{{autodesktop}}\\{{#MyAppName}}"; Filename: "{{app}}\\{{#MyAppExeName}}"; Tasks: desktopicon

            [Tasks]
            Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Accesos directos:"

            [Run]
            Filename: "{{app}}\\{{#MyAppExeName}}"; Description: "Abrir {{#MyAppName}}"; Flags: nowait postinstall skipifsilent

            [Code]
            var
              RemoveDataOnUninstall: Boolean;

            function DataDirPath: string;
            begin
              Result := ExpandConstant('{{userappdata}}\\{{#MyAppDataDir}}');
            end;

            procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
            begin
              if CurUninstallStep = usUninstall then
              begin
                RemoveDataOnUninstall := MsgBox(
                  'Quieres borrar tambien los datos de usuario guardados en AppData?',
                  mbConfirmation,
                  MB_YESNO
                ) = IDYES;
              end;

              if (CurUninstallStep = usPostUninstall) and RemoveDataOnUninstall then
              begin
                DelTree(DataDirPath, True, True, True);
              end;
            end;
            """
        ),
        encoding="utf-8",
    )
    return iss_path


def main() -> int:
    if not sys.platform.startswith("win"):
        print("El instalador Windows solo se genera desde Windows.")
        return 1

    code = build_exe()
    if code != 0:
        return code

    dist_dir = ROOT / "dist"
    app_path = dist_dir / APP_EXE
    if not app_path.exists():
        print(f"No existe {app_path}")
        return 1

    iscc = find_inno_setup()
    if not iscc:
        print("No encuentro Inno Setup Compiler (ISCC.exe).")
        return 1

    iss_path = build_iss(dist_dir)
    return subprocess.call([iscc, str(iss_path)], cwd=ROOT)


if __name__ == "__main__":
    raise SystemExit(main())
