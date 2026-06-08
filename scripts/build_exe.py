from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    command = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name",
        "LauncherEVA",
        "--onefile",
        "--noconsole",
        "--paths",
        str(ROOT / "src"),
        str(ROOT / "src" / "launcher_eva" / "__main__.py"),
    ]
    return subprocess.call(command, cwd=ROOT)


if __name__ == "__main__":
    raise SystemExit(main())
