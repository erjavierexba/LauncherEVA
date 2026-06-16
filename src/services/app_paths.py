from __future__ import annotations

import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path


APP_DIR_NAME = "Launcher EVA"


def code_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[2]


def user_data_dir() -> Path:
    override = os.environ.get("EVA_DATA_DIR")
    if override and override.strip():
        return Path(override).expanduser().resolve()

    system = platform.system().lower()
    if system == "windows":
        base = os.environ.get("APPDATA") or os.environ.get("LOCALAPPDATA")
        return Path(base).expanduser() / APP_DIR_NAME if base else Path.home() / "AppData" / "Roaming" / APP_DIR_NAME

    if system == "darwin":
        return Path.home() / "Library" / "Application Support" / APP_DIR_NAME

    base = os.environ.get("XDG_DATA_HOME")
    return (Path(base).expanduser() if base else Path.home() / ".local" / "share") / "launcher-eva"


def config_dir() -> Path:
    return user_data_dir() / "config"


def app_config_path() -> Path:
    return config_dir() / "eva.config.json"


def launcher_settings_path() -> Path:
    return user_data_dir() / "launcher.config.json"


def roles_root() -> Path:
    return user_data_dir() / "roles"


def data_assets_root() -> Path:
    return user_data_dir() / "assets"


def app_icon_path() -> Path:
    custom = data_assets_root() / "Eva_icon.png"
    if custom.exists():
        return custom
    return code_root() / "Eva_icon.png"


def snapshots_root() -> Path:
    return user_data_dir() / "managed_releases"


def ensure_app_data_layout() -> None:
    for directory in (config_dir(), roles_root(), data_assets_root(), snapshots_root()):
        directory.mkdir(parents=True, exist_ok=True)
    migrate_legacy_data()


def migrate_legacy_data() -> None:
    root = code_root()
    copy_missing_file(root / "config" / "eva.config.json", app_config_path())
    copy_missing_file(root / "launcher.config.json", launcher_settings_path())
    copy_missing_tree(root / "roles", roles_root())
    copy_missing_tree(root / "assets", data_assets_root())
    copy_missing_file(root / "Eva_icon.png", app_icon_path())

    bundled_assets = root / "src" / "web" / "assets"
    for pattern in ("theme_background.*", "eva_favicon.png"):
        for source in bundled_assets.glob(pattern):
            copy_missing_file(source, data_assets_root() / source.name)


def copy_missing_tree(source: Path, destination: Path) -> None:
    if not source.exists() or not source.is_dir():
        return

    for item in source.rglob("*"):
        relative = item.relative_to(source)
        target = destination / relative
        if item.is_dir():
            target.mkdir(parents=True, exist_ok=True)
        elif item.is_file():
            copy_missing_file(item, target)


def copy_missing_file(source: Path, destination: Path) -> None:
    if not source.exists() or not source.is_file() or destination.exists():
        return

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def resolve_data_relative(path: str | Path) -> Path:
    raw = Path(path)
    if raw.is_absolute():
        return raw
    return user_data_dir() / raw


def open_in_file_manager(path: Path) -> bool:
    target = Path(path)
    target.mkdir(parents=True, exist_ok=True)

    system = platform.system().lower()
    try:
        if system == "windows":
            os.startfile(str(target))  # type: ignore[attr-defined]
        elif system == "darwin":
            subprocess.Popen(["open", str(target)])
        else:
            opener = shutil.which("xdg-open") or shutil.which("gio")
            if not opener:
                return False
            command = [opener, "open", str(target)] if Path(opener).name == "gio" else [opener, str(target)]
            subprocess.Popen(command)
    except Exception:
        return False

    return True
