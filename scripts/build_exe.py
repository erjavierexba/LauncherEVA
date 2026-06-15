from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def add_data_args(source: Path, target: str) -> list[str]:
    if not source.exists():
        return []
    return ["--add-data", f"{source}{';' if sys.platform.startswith('win') else ':'}{target}"]


def main() -> int:
    hidden_imports = [
        "aiohttp",
        "pygame",
        "PySide6.QtCore",
        "PySide6.QtWebEngineWidgets",
        "PySide6.QtWidgets",
        "pyttsx3",
        "requests",
        "sounddevice",
        "vosk",
    ]

    command = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name",
        "LauncherEVA",
        "--onefile",
        "--windowed",
        "--paths",
        str(ROOT / "src"),
        *[arg for module in hidden_imports for arg in ("--hidden-import", module)],
        *add_data_args(ROOT / "main.py", "."),
        *add_data_args(ROOT / "requirements.txt", "."),
        *add_data_args(ROOT / "Eva_icon.png", "."),
        *add_data_args(ROOT / "src", "src"),
        *add_data_args(ROOT / "config", "config"),
        *add_data_args(ROOT / "media", "media"),
        *add_data_args(ROOT / "assets", "assets"),
        str(ROOT / "src" / "launcher_eva" / "desktop.py"),
    ]
    return subprocess.call(command, cwd=ROOT)


if __name__ == "__main__":
    raise SystemExit(main())
