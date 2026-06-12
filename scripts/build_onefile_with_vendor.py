from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    prepare = subprocess.call([sys.executable, str(ROOT / "scripts" / "prepare_vendor_linux.py")], cwd=ROOT)
    if prepare != 0:
        return prepare
    return subprocess.call([sys.executable, str(ROOT / "scripts" / "build_exe.py")], cwd=ROOT)


if __name__ == "__main__":
    raise SystemExit(main())
