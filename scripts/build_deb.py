from __future__ import annotations

import shutil
import subprocess
import textwrap
from pathlib import Path

from build_exe import ROOT, main as build_exe


PACKAGE = "launcher-eva"
VERSION = "0.1.0"


def main() -> int:
    code = build_exe()
    if code != 0:
        return code

    binary = ROOT / "dist" / "LauncherEVA"
    if not binary.exists():
        print(f"No existe {binary}")
        return 1

    package_root = ROOT / "build" / "deb" / PACKAGE
    if package_root.exists():
        shutil.rmtree(package_root)

    debian = package_root / "DEBIAN"
    opt_dir = package_root / "opt" / "LauncherEVA"
    bin_dir = package_root / "usr" / "bin"
    debian.mkdir(parents=True)
    opt_dir.mkdir(parents=True)
    bin_dir.mkdir(parents=True)

    shutil.copyfile(binary, opt_dir / "LauncherEVA")
    (opt_dir / "LauncherEVA").chmod(0o755)

    vendor = ROOT / "vendor"
    if vendor.exists():
        shutil.copytree(vendor, opt_dir / "vendor", ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))

    (debian / "control").write_text(
        textwrap.dedent(
            f"""\
            Package: {PACKAGE}
            Version: {VERSION}
            Section: utils
            Priority: optional
            Architecture: amd64
            Maintainer: Launcher EVA
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
            APP_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/LauncherEVA"
            mkdir -p "$APP_HOME"
            cp /opt/LauncherEVA/LauncherEVA "$APP_HOME/LauncherEVA"
            chmod +x "$APP_HOME/LauncherEVA"
            if [ -d /opt/LauncherEVA/vendor ] && [ ! -d "$APP_HOME/vendor" ]; then
              cp -a /opt/LauncherEVA/vendor "$APP_HOME/vendor"
            fi
            exec "$APP_HOME/LauncherEVA" "$@"
            """
        ),
        encoding="utf-8",
    )
    wrapper.chmod(0o755)

    output = ROOT / "dist" / f"{PACKAGE}_{VERSION}_amd64.deb"
    return subprocess.call(["dpkg-deb", "--build", str(package_root), str(output)], cwd=ROOT)


if __name__ == "__main__":
    raise SystemExit(main())
