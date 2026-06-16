from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def add_data_args(source: Path, target: str) -> list[str]:
    if not source.exists():
        return []
    return ["--add-data", f"{source}{';' if sys.platform.startswith('win') else ':'}{target}"]


def build_icon_arg() -> list[str]:
    source = ROOT / "Eva_icon.png"
    if not source.exists():
        return []

    if sys.platform.startswith("win"):
        ico_path = convert_png_to_ico(source)
        return ["--icon", str(ico_path)] if ico_path else []

    return ["--icon", str(source)]


def convert_png_to_ico(source: Path) -> Path | None:
    temp_target = Path(tempfile.gettempdir()) / "LauncherEVA_icon.ico"

    try:
        from PIL import Image

        image = Image.open(source)
        image.save(temp_target, format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
        return temp_target
    except Exception:
        pass

    try:
        from PySide6.QtGui import QImage

        image = QImage(str(source))
        if not image.isNull() and image.save(str(temp_target), "ICO"):
            return temp_target
    except Exception:
        pass

    return None


def build_binary(
    *,
    name: str = "LauncherEVA",
    distpath: Path | None = None,
    workpath: Path | None = None,
    specpath: Path | None = None,
) -> int:
    hidden_imports = [
        "aiohttp",
        "audioop",
        "cgi",
        "pygame",
        "PySide6.QtCore",
        "PySide6.QtWebEngineWidgets",
        "PySide6.QtWidgets",
        "pyttsx3",
        "requests",
        "sounddevice",
        "vosk",
    ]

    resolved_distpath = distpath or (ROOT / "dist")
    resolved_workpath = workpath or (ROOT / "build" / "pyinstaller")
    resolved_specpath = specpath or resolved_workpath
    resolved_distpath.mkdir(parents=True, exist_ok=True)
    resolved_workpath.mkdir(parents=True, exist_ok=True)
    resolved_specpath.mkdir(parents=True, exist_ok=True)

    command = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--name",
        name,
        "--onefile",
        "--windowed",
        "--distpath",
        str(resolved_distpath),
        "--workpath",
        str(resolved_workpath),
        "--specpath",
        str(resolved_specpath),
        "--paths",
        str(ROOT / "src"),
        "--collect-binaries",
        "vosk",
        "--collect-data",
        "vosk",
        *build_icon_arg(),
        *[arg for module in hidden_imports for arg in ("--hidden-import", module)],
        *add_data_args(ROOT / "main.py", "."),
        *add_data_args(ROOT / "requirements.txt", "."),
        *add_data_args(ROOT / "Eva_icon.png", "."),
        *add_data_args(ROOT / "src", "src"),
        str(ROOT / "src" / "launcher_eva" / "desktop.py"),
    ]
    return subprocess.call(command, cwd=ROOT)


def main() -> int:
    return build_binary()


if __name__ == "__main__":
    raise SystemExit(main())
