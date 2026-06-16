from __future__ import annotations

import shutil
import subprocess
import textwrap
from pathlib import Path

from build_exe import ROOT, build_binary


PACKAGE = "launcher-eva"
VERSION = "1.0"


def main() -> int:
    package_root = ROOT / "build" / "deb" / PACKAGE
    pyinstaller_root = ROOT / "build" / "deb-pyinstaller"
    dist_dir = pyinstaller_root / "dist"
    work_dir = pyinstaller_root / "work"
    spec_dir = pyinstaller_root / "spec"

    if pyinstaller_root.exists():
        shutil.rmtree(pyinstaller_root)

    code = build_binary(
        distpath=dist_dir,
        workpath=work_dir,
        specpath=spec_dir,
    )
    if code != 0:
        return code

    binary = dist_dir / "LauncherEVA"
    if not binary.exists():
        print(f"No existe {binary}")
        return 1

    if package_root.exists():
        shutil.rmtree(package_root)

    debian = package_root / "DEBIAN"
    opt_dir = package_root / "opt" / "LauncherEVA"
    bin_dir = package_root / "usr" / "bin"
    applications_dir = package_root / "usr" / "share" / "applications"
    icons_dir = package_root / "usr" / "share" / "icons" / "hicolor" / "512x512" / "apps"
    debian.mkdir(parents=True)
    opt_dir.mkdir(parents=True)
    bin_dir.mkdir(parents=True)
    applications_dir.mkdir(parents=True)
    icons_dir.mkdir(parents=True)

    shutil.copyfile(binary, opt_dir / "LauncherEVA")
    (opt_dir / "LauncherEVA").chmod(0o755)
    shutil.copyfile(ROOT / "Eva_icon.png", icons_dir / "launcher-eva.png")

    (debian / "control").write_text(
        textwrap.dedent(
            f"""\
            Package: {PACKAGE}
            Version: {VERSION}
            Section: utils
            Priority: optional
            Architecture: amd64
            Maintainer: Launcher EVA
            Depends: libxcb-cursor0
            Description: Launcher local autocontenido para EVA y cliente web
            """
        ),
        encoding="utf-8",
    )

    wrapper = bin_dir / "launcher-eva"
    wrapper.write_text(
        textwrap.dedent(
            """\
            #!/usr/bin/env sh
            set -eu
            exec /opt/LauncherEVA/LauncherEVA "$@"
            """
        ),
        encoding="utf-8",
    )
    wrapper.chmod(0o755)

    cleanup = bin_dir / "launcher-eva-purge-data"
    cleanup.write_text(
        textwrap.dedent(
            """\
            #!/usr/bin/env sh
            set -eu
            DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/launcher-eva"
            LEGACY_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/LauncherEVA"
            echo "Se van a borrar los datos locales de Launcher EVA."
            echo " - $DATA_DIR"
            echo " - $LEGACY_DIR"
            printf "Escribe BORRAR para confirmar: "
            read -r ANSWER
            if [ "$ANSWER" != "BORRAR" ]; then
              echo "Cancelado."
              exit 0
            fi
            rm -rf "$DATA_DIR" "$LEGACY_DIR"
            echo "Datos eliminados."
            """
        ),
        encoding="utf-8",
    )
    cleanup.chmod(0o755)

    desktop_file = applications_dir / "launcher-eva.desktop"
    desktop_file.write_text(
        textwrap.dedent(
            """\
            [Desktop Entry]
            Type=Application
            Name=Launcher EVA
            Comment=Configurador y cliente local para EVA
            Exec=launcher-eva
            Icon=launcher-eva
            Terminal=false
            Categories=Utility;
            StartupNotify=true
            """
        ),
        encoding="utf-8",
    )

    output = ROOT / "dist" / f"{PACKAGE}_{VERSION}_amd64.deb"
    if output.exists():
        output.unlink()

    try:
        return subprocess.call(["dpkg-deb", "--build", str(package_root), str(output)], cwd=ROOT)
    finally:
        if pyinstaller_root.exists():
            shutil.rmtree(pyinstaller_root)


if __name__ == "__main__":
    raise SystemExit(main())
