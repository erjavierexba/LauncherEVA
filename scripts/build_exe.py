from __future__ import annotations

import subprocess
import sys
import tempfile
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def add_data_args(source: Path, target: str) -> list[str]:
    if not source.exists():
        return []
    return ["--add-data", f"{source}{';' if sys.platform.startswith('win') else ':'}{target}"]


def ignore_project_artifacts(directory: str, names: list[str]) -> set[str]:
    ignored = {
        ".git",
        ".venv",
        "venv",
        "env",
        "__pycache__",
        "node_modules",
        ".expo",
        "dist",
        "build",
        ".gradle",
        ".kotlin",
        ".cxx",
        ".idea",
        ".vscode",
        "vosk-model-es-0.42",
        "vosk-model-es-0.42.zip",
        "google-services.json",
        "firebase-service-account.json",
    }
    return {
        name
        for name in names
        if name in ignored
        or name.endswith(".pyc")
        or name.endswith(".mp3")
        or name.endswith(".tsbuildinfo")
    }


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="launcher-eva-build-") as temp_dir:
        staged_root = Path(temp_dir)
        staged_projects = staged_root / "projects"
        shutil.copytree(ROOT / "projects", staged_projects, ignore=ignore_project_artifacts)
        hidden_imports = [
            "aiohttp",
            "firebase_admin",
            "pygame",
            "pyttsx3",
            "requests",
            "sounddevice",
            "vosk",
            "websockets",
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
            *add_data_args(staged_projects, "projects"),
            *add_data_args(ROOT / "vendor", "vendor"),
            str(ROOT / "src" / "launcher_eva" / "desktop.py"),
        ]
        return subprocess.call(command, cwd=ROOT)


if __name__ == "__main__":
    raise SystemExit(main())
