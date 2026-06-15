from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    prepare = subprocess.call([sys.executable, str(ROOT / "scripts" / "prepare_vendor_linux.py")], cwd=ROOT)
    if prepare != 0:
        return prepare
    env = os.environ.copy()
    env["LAUNCHER_EVA_EMBED_VENDOR"] = "1"
    return subprocess.call([sys.executable, str(ROOT / "scripts" / "build_exe.py")], cwd=ROOT, env=env)


if __name__ == "__main__":
    raise SystemExit(main())
