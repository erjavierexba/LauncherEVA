from __future__ import annotations

import cgi
import html
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unicodedata
import webbrowser
import socket
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from src.services.network import get_base_url
from src.services.app_paths import (
    app_config_path,
    app_icon_path,
    code_root,
    data_assets_root,
    ensure_app_data_layout,
    launcher_settings_path,
    open_in_file_manager,
    roles_root,
    snapshots_root,
    user_data_dir,
)
from src.services.vosk_model import ensure_vosk_model, ensure_vosk_model_in_background, vosk_model_dir


APP_TITLE = "Launcher EVA"
PUBLIC_BRANCH = "public_release"
CONFIG_FILE = "launcher.config.json"
PORT = 8787
SNAPSHOT_ROOT = "managed_releases"
MAX_CONTROLLER_LOG_LINES = 10000

ALLOWED_MEDIA_EXTENSIONS = {
    ".md",
    ".png",
    ".mp4",
    ".ogg",
    ".mp3",
    ".wav",
    ".webm",
    ".pdf",
}
ALLOWED_THEME_BACKGROUND_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
}
FAVICON_PATH = Path("src") / "web" / "assets" / "eva_favicon.png"

THEME_PRESETS = {
    "eva": {
        "label": "EVA oscuro",
        "theme": {
            "title": "Panel de Control EVA",
            "background": "#0d0f12",
            "surface": "#1a1f27",
            "surfaceAlt": "#111419",
            "inputBackground": "#0f141b",
            "text": "#ededed",
            "muted": "#9fa7b3",
            "accent": "#c9a24a",
            "primary": "#66ccff",
            "danger": "#c65353",
            "radius": "8px",
        },
    },
    "clinico": {
        "label": "Clínico",
        "theme": {
            "title": "Panel de Control EVA",
            "background": "#f4f7fb",
            "surface": "#ffffff",
            "surfaceAlt": "#edf2f7",
            "inputBackground": "#ffffff",
            "text": "#15202b",
            "muted": "#657786",
            "accent": "#2f80ed",
            "primary": "#00a36c",
            "danger": "#d64545",
            "radius": "8px",
        },
    },
    "arcano": {
        "label": "Arcano",
        "theme": {
            "title": "Panel de Control EVA",
            "background": "#120f18",
            "surface": "#211b2b",
            "surfaceAlt": "#17111f",
            "inputBackground": "#120f18",
            "text": "#f1ecff",
            "muted": "#b4a7ca",
            "accent": "#d4a84f",
            "primary": "#72d1d8",
            "danger": "#d95d75",
            "radius": "8px",
        },
    },
}


def app_root() -> Path:
    return code_root()


def runtime_assets_root() -> Path:
    return data_assets_root()


def runtime_sqlite_path() -> Path:
    return app_root() / "eva.sqlite3"


def ensure_runtime_layout() -> None:
    ensure_app_data_layout()
    runtime_assets_root().mkdir(parents=True, exist_ok=True)


def bundled_root() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return app_root()


def seed_bundled_projects() -> None:
    if not getattr(sys, "frozen", False):
        return
    source_root = bundled_root()
    destination_root = app_root()
    for directory in ("src", "config", "media", "assets"):
        source = source_root / directory
        destination = destination_root / directory
        if source.exists() and not destination.exists():
            shutil.copytree(source, destination, ignore=shutil.ignore_patterns(
                ".git",
                "__pycache__",
                "*.pyc",
            ))
    for filename in ("main.py", "requirements.txt", "Eva_icon.png"):
        source = source_root / filename
        destination = destination_root / filename
        if source.exists() and not destination.exists():
            shutil.copyfile(source, destination)


def default_settings() -> dict:
    return {
        "role_name": "EVA",
        "app_subtitle": "EVA mantiene el vinculo abierto",
        "web_port": "8000",
        "client_port": "8080",
        "microphone_device": "",
        "db_max_backups": "10",
    }


def load_json(path: Path, fallback):
    if not path.exists():
        return fallback
    try:
        with path.open("r", encoding="utf-8") as file:
            return json.load(file)
    except (OSError, json.JSONDecodeError):
        return fallback


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")


def strip_accents(text: str) -> str:
    return "".join(
        char
        for char in unicodedata.normalize("NFD", text)
        if unicodedata.category(char) != "Mn"
    )


def normalize(text: str) -> str:
    text = strip_accents(text.lower().strip()).replace("_", " ")
    return re.sub(r"\s+", " ", text).strip()


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", normalize(text)).strip("_") or "archivo"


def app_slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", normalize(text)).strip("-") or "rol"


def unique_path(directory: Path, filename: str) -> Path:
    candidate = directory / filename
    if not candidate.exists():
        return candidate
    counter = 2
    while True:
        next_candidate = directory / f"{candidate.stem}_{counter}{candidate.suffix}"
        if not next_candidate.exists():
            return next_candidate
        counter += 1


def h(value) -> str:
    return html.escape(str(value or ""), quote=True)


def is_hex_color(value: str) -> bool:
    return bool(re.fullmatch(r"#[0-9a-fA-F]{6}", str(value or "").strip()))


def parse_port(value, fallback: int) -> int:
    try:
        port = int(value)
    except (TypeError, ValueError):
        return fallback

    if 1 <= port <= 65535:
        return port

    return fallback


def render_theme_input(key: str, value: str) -> str:
    if key in {"title", "radius"}:
        return f'<label>{h(key)}<input name="{h(key)}" value="{h(value)}"></label>'

    if key == "background":
        color_value = value if is_hex_color(value) else "#000000"
        return (
            f'<label>{h(key)}'
            f'<span class="color-field">'
            f'<input class="color-picker" type="color" value="{h(color_value)}" data-color-target="{h(key)}">'
            f'<input class="color-text" name="{h(key)}" value="{h(value)}" data-color-name="{h(key)}">'
            f'</span>'
            f'<input type="file" name="background_file" accept="image/png,image/jpeg,image/webp">'
            f'</label>'
        )

    color_value = value if is_hex_color(value) else "#000000"
    return (
        f'<label>{h(key)}'
        f'<span class="color-field">'
        f'<input class="color-picker" type="color" value="{h(color_value)}" data-color-target="{h(key)}">'
        f'<input class="color-text" name="{h(key)}" value="{h(value)}" data-color-name="{h(key)}" '
        f'pattern="#[0-9a-fA-F]{{6}}">'
        f'</span>'
        f'</label>'
    )


def microphone_devices() -> list[dict[str, str]]:
    try:
        import sounddevice as sd

        devices = sd.query_devices()
    except Exception:
        return []

    items = []
    for index, device in enumerate(devices):
        try:
            input_channels = int(device.get("max_input_channels", 0))
        except (AttributeError, TypeError, ValueError):
            input_channels = 0

        if input_channels <= 0:
            continue

        name = str(device.get("name", f"Dispositivo {index}"))
        hostapi = str(device.get("hostapi", ""))
        items.append({
            "id": str(index),
            "name": name,
            "label": f"{index} · {name}",
            "hostapi": hostapi,
        })

    return items


class LauncherState:
    def __init__(self):
        seed_bundled_projects()
        ensure_runtime_layout()
        self.settings_path = launcher_settings_path()
        self.settings = default_settings()
        loaded = load_json(self.settings_path, {})
        if isinstance(loaded, dict):
            self.settings.update(loaded)
        self.logs: list[str] = []
        self.events: queue.Queue[str] = queue.Queue()
        self.eva_process: subprocess.Popen | None = None
        self.embedded_mode = False
        self.lock = threading.Lock()
        ensure_vosk_model_in_background(self.log)

    def log(self, message: str) -> None:
        line = f"[{time.strftime('%H:%M:%S')}] {message}"
        with self.lock:
            self.logs.append(line)
            if len(self.logs) > MAX_CONTROLLER_LOG_LINES:
                self.logs = self.logs[-MAX_CONTROLLER_LOG_LINES:]
        print(line)

    def save_settings(self, form: dict[str, str]) -> None:
        for key in [
            "role_name",
            "app_subtitle",
            "web_port",
            "client_port",
            "microphone_device",
            "db_max_backups",
        ]:
            if key in form:
                self.settings[key] = form[key].strip()
        save_json(self.settings_path, self.settings)
        self.log("Configuración del launcher guardada.")
        self.apply_release_configuration()

    def eva_path(self) -> Path:
        return app_root()

    def eva_config_path(self) -> Path:
        return app_config_path()

    def media_root(self) -> Path:
        return self.role_repository_root() / "media"

    def role_repository_root(self) -> Path:
        return roles_root() / app_slug(self.role_name())

    def favicon_source_path(self) -> Path:
        icon = app_icon_path()
        if icon.exists():
            return icon

        bundled = app_root() / FAVICON_PATH
        if bundled.exists():
            return bundled

        return data_assets_root() / FAVICON_PATH.name

    def aliases_path(self) -> Path:
        return self.media_root() / "aliases.json"

    def eva_config(self) -> dict:
        fallback = {
            "assistant": {"name": "EVA", "wakeWord": "eva"},
            "theme": THEME_PRESETS["eva"]["theme"],
            "users": [],
        }
        data = load_json(self.eva_config_path(), fallback)
        return data if isinstance(data, dict) else fallback

    def save_eva_config(self, data: dict) -> None:
        save_json(self.eva_config_path(), data)

    def command_environment(self) -> dict[str, str]:
        env = os.environ.copy()
        self.role_repository_root().mkdir(parents=True, exist_ok=True)
        env["EVA_DB_PATH"] = str(self.role_repository_root() / "eva.sqlite3")
        env["EVA_DB_MAX_BACKUPS"] = str(self.db_max_backups())
        env["EVA_MEDIA_ROOT"] = str(self.media_root())
        env["PYTHONUNBUFFERED"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"
        return env

    def run_command(self, command: list[str], cwd: Path, label: str) -> int:
        self.log(f"$ {' '.join(command)} [{cwd}]")
        try:
            process = subprocess.Popen(
                command,
                cwd=str(cwd),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=1,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=self.command_environment(),
            )
        except OSError as error:
            self.log(f"[{label}] No se pudo ejecutar: {error}")
            return 1

        assert process.stdout is not None
        for line in process.stdout:
            self.log(line.rstrip())
        code = process.wait()
        self.log(f"[{label}] terminado con código {code}.")
        return code

    def capture_command(self, command: list[str], cwd: Path) -> str:
        try:
            result = subprocess.run(command, cwd=cwd, text=True, capture_output=True, check=False)
        except OSError:
            return ""
        return (result.stdout or "").strip()

    def current_release_root(self) -> Path:
        return snapshots_root() / "current"

    def timestamped_release_root(self) -> Path:
        return snapshots_root() / datetime.now().strftime("%Y%m%d-%H%M%S")

    def snapshot_ignore(self, directory: str, names: list[str]) -> set[str]:
        ignored = {
            ".git",
            ".venv",
            ".venv-build",
            "__pycache__",
            "dist",
            "build",
            ".idea",
            ".vscode",
            "managed_releases",
            VOSK_MODEL_DIR,
            VOSK_MODEL_ZIP,
        }
        return {
            name
            for name in names
            if name in ignored
            or name.endswith(".pyc")
            or name.endswith(".sqlite3")
            or ".sqlite3.backup-" in name
        }

    def snapshot_project(self, name: str, source: Path, destination: Path) -> dict:
        if not source.exists():
            self.log(f"[{name}] No existe {source}; no puedo crear snapshot.")
            return {"name": name, "source": source.as_posix(), "error": "missing_source"}

        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(source, destination, ignore=self.snapshot_ignore)

        branch = self.capture_command(["git", "branch", "--show-current"], source)
        commit = self.capture_command(["git", "rev-parse", "HEAD"], source)
        status = self.capture_command(["git", "status", "--short"], source)
        bundle_path = destination.parent / f"{destination.name}.git.bundle"
        if (source / ".git").exists():
            code = self.run_command(["git", "bundle", "create", str(bundle_path), "--all"], source, name)
            if code != 0:
                self.log(f"[{name}] No se pudo crear git bundle.")

        metadata = {
            "name": name,
            "source": source.as_posix(),
            "snapshot": destination.as_posix(),
            "branch": branch,
            "commit": commit,
            "dirty": bool(status),
            "status": status,
            "gitBundle": bundle_path.as_posix() if bundle_path.exists() else "",
            "createdAt": datetime.now().isoformat(timespec="seconds"),
        }
        save_json(destination / "snapshot.manifest.json", metadata)
        self.log(f"[{name}] Snapshot creado en {destination}.")
        return metadata

    def create_safe_snapshots(self) -> None:
        timestamp_root = self.timestamped_release_root()
        current_root = self.current_release_root()
        timestamp_root.mkdir(parents=True, exist_ok=True)
        current_root.mkdir(parents=True, exist_ok=True)

        eva_metadata = self.snapshot_project("LauncherEVA", self.eva_path(), timestamp_root / "LauncherEVA")

        for source_name, target_name in [("LauncherEVA", "LauncherEVA")]:
            source = timestamp_root / source_name
            target = current_root / target_name
            if target.exists():
                shutil.rmtree(target)
            if source.exists():
                shutil.copytree(source, target)

        for bundle in timestamp_root.glob("*.git.bundle"):
            shutil.copyfile(bundle, current_root / bundle.name)

        manifest = {
            "createdAt": datetime.now().isoformat(timespec="seconds"),
            "eva": eva_metadata,
        }
        save_json(timestamp_root / "release.manifest.json", manifest)
        save_json(current_root / "release.manifest.json", manifest)
        self.log(f"Copia segura actualizada en {current_root}.")

    def ensure_eva_dependencies(self) -> None:
        eva_path = self.eva_path()
        if not (eva_path / "requirements.txt").exists():
            self.log("[EVA] No encuentro requirements.txt; salto dependencias Python.")
            return

        venv_path = eva_path / ".venv"
        python_bin = venv_path / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        if not python_bin.exists():
            self.run_command([sys.executable, "-m", "venv", str(venv_path)], eva_path, "EVA")
        executable = str(python_bin if python_bin.exists() else Path(sys.executable))
        self.run_command([executable, "-m", "pip", "install", "--upgrade", "pip"], eva_path, "EVA")
        self.run_command([executable, "-m", "pip", "install", "-r", "requirements.txt"], eva_path, "EVA")

    def ensure_vosk_model(self) -> None:
        model_dir = vosk_model_dir()
        if model_dir.exists():
            self.log(f"[EVA] Modelo Vosk ya disponible: {model_dir}.")
            return
        ensure_vosk_model(self.log)

    def ensure_horus_dependencies(self) -> None:
        self.log("[Jugadores] La web de jugadores forma parte de EVA; no hay dependencias Node separadas.")

    def prepare_public_release_workflow(self) -> None:
        self.log("Preparando workflow completo de public release.")
        self.create_safe_snapshots()
        self.apply_release_configuration()
        self.ensure_eva_dependencies()
        self.ensure_vosk_model()
        self.ensure_horus_dependencies()
        self.log("Workflow preparado: snapshots, dependencias y Vosk listos.")

    def update_repo(self, name: str, path: Path, remote_url: str = "") -> None:
        if not path.exists():
            if not remote_url:
                self.log(f"[{name}] No existe {path}. Configura un remote para clonar o corrige la ruta.")
                return
            path.parent.mkdir(parents=True, exist_ok=True)
            self.run_command(["git", "clone", "--branch", PUBLIC_BRANCH, remote_url, str(path)], path.parent, name)

        if not (path / ".git").exists():
            self.log(f"[{name}] {path} no parece un repo git.")
            return

        status = subprocess.run(["git", "status", "--porcelain"], cwd=path, text=True, capture_output=True)
        if status.stdout.strip():
            self.log(f"[{name}] Hay cambios sin commitear. No hago pull para no pisar trabajo local.")
            self.log(status.stdout.rstrip())
            return

        self.run_command(["git", "fetch", "--all", "--prune"], path, name)
        self.run_command(["git", "checkout", PUBLIC_BRANCH], path, name)
        code = self.run_command(["git", "pull", "--ff-only", "origin", PUBLIC_BRANCH], path, name)
        if code != 0:
            self.log(f"[{name}] Pull falló. Comprueba que origin/{PUBLIC_BRANCH} existe.")

    def update_both(self) -> None:
        self.update_repo("LauncherEVA", self.eva_path(), "")

    def start_eva(self) -> None:
        if self.eva_process and self.eva_process.poll() is None:
            self.log("EVA ya está arrancada desde este launcher.")
            return

        eva_path = self.eva_path()
        if not (eva_path / "main.py").exists():
            self.log("No encuentro main.py en la ruta de EVA.")
            return

        if getattr(sys, "frozen", False):
            command = [str(Path(sys.executable)), "--run-eva", str(eva_path)]
        else:
            venv_python = eva_path / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
            executable = str(venv_python if venv_python.exists() else Path(sys.executable))
            command = [executable, "-u", "main.py"]
        self.log(f"Arrancando EVA con {' '.join(command)}")
        self.eva_process = subprocess.Popen(
            command,
            cwd=eva_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=1,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=self.command_environment(),
        )
        threading.Thread(target=self.pipe_process, args=(self.eva_process,), daemon=True).start()

    def pipe_process(self, process: subprocess.Popen) -> None:
        assert process.stdout is not None
        for line in process.stdout:
            self.log(f"[EVA] {line.rstrip()}")
        self.log(f"[EVA] proceso terminado con código {process.wait()}.")

    def stop_eva(self) -> None:
        if not self.eva_process or self.eva_process.poll() is not None:
            self.log("EVA no está arrancada desde este launcher.")
            return
        self.eva_process.terminate()
        try:
            self.eva_process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            self.eva_process.kill()
            self.eva_process.wait(timeout=3)
        self.eva_process = None
        self.log("EVA detenida.")

    def save_theme(self, form: dict[str, str], background_upload: dict | None = None) -> None:
        keys = ["title", "background", "surface", "surfaceAlt", "inputBackground", "text", "muted", "accent", "primary", "danger", "radius"]
        config = self.eva_config()
        theme = {key: form.get(key, "").strip() for key in keys}
        if background_upload:
            uploaded_background = self.set_theme_background_upload(
                background_upload["path"],
                background_upload["filename"],
            )
            if uploaded_background:
                theme["background"] = uploaded_background
        config["theme"] = theme
        self.save_eva_config(config)
        self.log("Tema guardado en EVA.")
        self.apply_release_configuration()

    def set_theme_background_upload(self, upload_path: Path, original_name: str) -> str:
        extension = Path(original_name).suffix.lower()
        if extension not in ALLOWED_THEME_BACKGROUND_EXTENSIONS:
            self.log(f"Fondo no permitido: {extension}")
            return ""

        assets_root = data_assets_root()
        assets_root.mkdir(parents=True, exist_ok=True)
        for old_background in assets_root.glob("theme_background.*"):
            if old_background.is_file():
                old_background.unlink()

        destination = assets_root / f"theme_background{extension}"
        shutil.copyfile(upload_path, destination)
        return f"/assets/{destination.name}?v={int(time.time())}"

    def open_data_folder(self) -> None:
        opened = open_in_file_manager(user_data_dir())
        if opened:
            self.log(f"Carpeta de datos abierta: {user_data_dir()}.")
        else:
            self.log(f"No pude abrir la carpeta automáticamente. Ruta: {user_data_dir()}.")

    def apply_preset(self, preset: str) -> None:
        if preset not in THEME_PRESETS:
            return
        config = self.eva_config()
        config["theme"] = dict(THEME_PRESETS[preset]["theme"])
        self.save_eva_config(config)
        self.log(f"Tema aplicado: {THEME_PRESETS[preset]['label']}.")
        self.apply_release_configuration()

    def users(self) -> list[dict]:
        users = self.eva_config().get("users", [])
        if not isinstance(users, list):
            return []
        clean = []
        for user in users:
            if not isinstance(user, dict):
                continue
            name = str(user.get("name", "")).strip()
            if not name:
                continue
            aliases = [str(alias).strip() for alias in user.get("aliases", []) if str(alias).strip()]
            clean.append({"name": name, "aliases": sorted(set(aliases))})
        return sorted(clean, key=lambda item: item["name"].lower())

    def save_users(self, users: list[dict]) -> None:
        config = self.eva_config()
        config["users"] = sorted(users, key=lambda item: item["name"].lower())
        self.save_eva_config(config)

    def upsert_user(self, name: str, aliases_text: str) -> None:
        clean_name = name.strip()
        if not clean_name:
            self.log("Jugador ignorado: falta nombre.")
            return
        aliases = [alias.strip() for alias in aliases_text.split(",") if alias.strip()]
        users = [user for user in self.users() if normalize(user["name"]) != normalize(clean_name)]
        users.append({"name": clean_name, "aliases": aliases})
        self.save_users(users)
        self.log(f"Jugador guardado: {clean_name}.")

    def delete_user(self, name: str) -> None:
        users = [user for user in self.users() if user["name"] != name]
        self.save_users(users)
        self.log(f"Jugador eliminado de config: {name}.")

    def aliases(self) -> dict[str, str]:
        data = load_json(self.aliases_path(), {})
        return data if isinstance(data, dict) else {}

    def save_aliases(self, aliases: dict[str, str]) -> None:
        save_json(self.aliases_path(), aliases)

    def add_aliases(self, filename: str, display_name: str, aliases_text: str) -> None:
        aliases = self.aliases()
        for raw in [display_name, *aliases_text.split(",")]:
            key = normalize(raw)
            if key:
                aliases[key] = filename
        self.save_aliases(aliases)

    def media_items(self) -> list[dict]:
        root = self.media_root()
        aliases_by_file: dict[str, list[str]] = {}
        for alias, filename in self.aliases().items():
            aliases_by_file.setdefault(filename, []).append(alias)
        if not root.exists():
            return []
        items = []
        for path in sorted(root.iterdir(), key=lambda item: item.name.lower()):
            if path.is_file() and path.suffix.lower() in ALLOWED_MEDIA_EXTENSIONS:
                items.append({
                    "filename": path.name,
                    "type": path.suffix.lower().lstrip(".").upper(),
                    "aliases": ", ".join(sorted(aliases_by_file.get(path.name, []))),
                })
        return items

    def add_media_upload(self, upload_path: Path, original_name: str, display_name: str, aliases_text: str) -> None:
        extension = Path(original_name).suffix.lower()
        if extension not in ALLOWED_MEDIA_EXTENSIONS:
            self.log(f"Extensión no permitida: {extension}")
            return
        display_name = display_name.strip() or Path(original_name).stem
        self.media_root().mkdir(parents=True, exist_ok=True)
        destination = unique_path(self.media_root(), f"{slugify(display_name)}{extension}")
        shutil.copyfile(upload_path, destination)
        self.add_aliases(destination.name, display_name, aliases_text)
        self.log(f"Archivo añadido a media: {destination.name}.")

    def add_joke(self, name: str, text: str, aliases_text: str) -> None:
        if not name.strip() or not text.strip():
            self.log("Broma ignorada: falta nombre o texto.")
            return
        self.media_root().mkdir(parents=True, exist_ok=True)
        destination = unique_path(self.media_root(), f"{slugify(name)}.md")
        destination.write_text(f"# {name.strip()}\n\n{text.strip()}\n", encoding="utf-8")
        self.add_aliases(destination.name, name, aliases_text)
        self.log(f"Broma creada: {destination.name}.")

    def delete_media(self, filename: str) -> None:
        clean = Path(filename).name
        path = self.media_root() / clean
        if path.exists() and path.is_file():
            path.unlink()
        self.save_aliases({alias: target for alias, target in self.aliases().items() if target != clean})
        self.log(f"Archivo eliminado: {clean}.")

    def set_intro_upload(self, upload_path: Path, original_name: str) -> None:
        if Path(original_name).suffix.lower() != ".mp3":
            self.log("La intro debe ser un MP3.")
            return
        destination = runtime_assets_root() / "music" / "despertar.mp3"
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(upload_path, destination)
        self.log("Música de intro actualizada: assets/music/despertar.mp3.")

    def role_name(self) -> str:
        return self.settings.get("role_name", "").strip() or "EVA"

    def app_subtitle(self) -> str:
        return self.settings.get("app_subtitle", "").strip() or "EVA mantiene el vinculo abierto"

    def db_max_backups(self) -> int:
        try:
            value = int(self.settings.get("db_max_backups", "10"))
        except (TypeError, ValueError):
            return 10

        return max(0, value)

    def apply_release_configuration(self) -> None:
        role_name = self.role_name()
        config = self.eva_config()
        assistant = config.get("assistant") if isinstance(config.get("assistant"), dict) else {}
        theme = config.get("theme") if isinstance(config.get("theme"), dict) else {}
        assistant["name"] = assistant.get("name") or "EVA"
        theme["title"] = f"Panel {role_name}"
        config["assistant"] = assistant
        config["theme"] = theme
        config["project"] = {
            "roleName": role_name,
            "appSubtitle": self.app_subtitle(),
            "repository": str(Path("roles") / app_slug(role_name)),
        }
        config["server"] = {
            "host": "0.0.0.0",
            "evaPort": parse_port(self.settings.get("web_port"), 8000),
            "clientPort": parse_port(self.settings.get("client_port"), 8080),
        }
        config["database"] = {
            "maxBackups": self.db_max_backups(),
        }
        microphone_id = self.settings.get("microphone_device", "").strip()
        config["audio"] = {
            "inputDeviceId": microphone_id,
            "inputDeviceName": self.microphone_name(microphone_id),
        }
        config.pop("firebase", None)
        config.pop("network", None)
        self.save_eva_config(config)

        self.log("Configuración propagada al proyecto combinado.")

    def microphone_name(self, microphone_id: str) -> str:
        if not microphone_id:
            return ""

        for device in microphone_devices():
            if device["id"] == microphone_id:
                return device["name"]

        return ""

    def build_horus_release(self) -> None:
        self.log("[Jugadores] La app de jugadores es una web integrada en EVA. No hay paquete nativo separado.")


STATE = LauncherState()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/":
            self.send_html(render_page())
            return
        if path == "/logs":
            self.send_text("\n".join(STATE.logs))
            return
        if path in {"/favicon.png", "/favicon.ico"}:
            self.send_file(STATE.favicon_source_path(), "image/png")
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self):
        path = urlparse(self.path).path
        if path in {"/media/upload", "/intro/upload", "/theme"}:
            form, files = self.multipart()
        else:
            form = self.form()
            files = {}

        if path == "/settings":
            STATE.save_settings(form)
        elif path == "/pull":
            target = form.get("target", "both")
            if target == "eva":
                background(STATE.update_repo, "LauncherEVA", STATE.eva_path(), "")
            else:
                background(STATE.update_both)
        elif path == "/start-eva":
            background(STATE.start_eva)
        elif path == "/stop-eva":
            STATE.stop_eva()
        elif path == "/theme":
            upload = files.get("background_file")
            STATE.save_theme(form, upload)
            if upload:
                upload["path"].unlink(missing_ok=True)
        elif path == "/theme/preset":
            STATE.apply_preset(form.get("preset", "eva"))
        elif path == "/apply-release":
            STATE.apply_release_configuration()
        elif path == "/open-data-folder":
            STATE.open_data_folder()
        elif path == "/prepare-workflow":
            background(STATE.prepare_public_release_workflow)
        elif path == "/build/horus":
            background(STATE.build_horus_release)
        elif path == "/players/add":
            STATE.upsert_user(form.get("name", ""), form.get("aliases", ""))
        elif path == "/players/delete":
            STATE.delete_user(form.get("name", ""))
        elif path == "/media/upload":
            uploads = [
                (key, files[key])
                for key in sorted(files)
                if key == "file" or key.startswith("file_")
            ]
            for index, (_key, upload) in enumerate(uploads):
                STATE.add_media_upload(
                    upload["path"],
                    upload["filename"],
                    form.get(f"name_{index}", form.get("name", "")),
                    form.get(f"aliases_{index}", form.get("aliases", "")),
                )
                upload["path"].unlink(missing_ok=True)
        elif path == "/media/delete":
            STATE.delete_media(form.get("filename", ""))
        elif path == "/jokes/add":
            STATE.add_joke(form.get("name", ""), form.get("text", ""), form.get("aliases", ""))
        elif path == "/intro/upload":
            upload = files.get("file")
            if upload:
                STATE.set_intro_upload(upload["path"], upload["filename"])
                upload["path"].unlink(missing_ok=True)
        else:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        self.redirect("/")

    def form(self) -> dict[str, str]:
        length = int(self.headers.get("Content-Length", "0") or 0)
        body = self.rfile.read(length).decode("utf-8", errors="replace")
        return {key: values[-1] for key, values in parse_qs(body).items()}

    def multipart(self) -> tuple[dict[str, str], dict[str, dict]]:
        form: dict[str, str] = {}
        files: dict[str, dict] = {}
        content_type = self.headers.get("Content-Type", "")
        environ = {
            "REQUEST_METHOD": "POST",
            "CONTENT_TYPE": content_type,
            "CONTENT_LENGTH": self.headers.get("Content-Length", "0"),
        }
        fields = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ=environ)
        for key in fields:
            item = fields[key]
            if isinstance(item, list):
                for index, subitem in enumerate(item):
                    if subitem.filename:
                        suffix = Path(subitem.filename).suffix
                        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
                            shutil.copyfileobj(subitem.file, temp)
                            files[f"{key}_{index}"] = {"path": Path(temp.name), "filename": subitem.filename}
                    else:
                        form[f"{key}_{index}"] = subitem.value
                continue
            if item.filename:
                suffix = Path(item.filename).suffix
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
                    shutil.copyfileobj(item.file, temp)
                    files[key] = {"path": Path(temp.name), "filename": item.filename}
            else:
                form[key] = item.value
        return form, files

    def send_html(self, body: str) -> None:
        data = body.encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_text(self, body: str) -> None:
        data = body.encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_file(self, path: Path, content_type: str) -> None:
        if not path.exists() or not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        data = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def redirect(self, location: str) -> None:
        self.send_response(HTTPStatus.SEE_OTHER)
        self.send_header("Location", location)
        self.end_headers()

    def log_message(self, _format, *args):
        return


def background(func, *args) -> None:
    threading.Thread(target=func, args=args, daemon=True).start()


def render_page() -> str:
    config = STATE.eva_config()
    theme = dict(THEME_PRESETS["eva"]["theme"])
    if isinstance(config.get("theme"), dict):
        theme.update(config["theme"])
    users = STATE.users()
    media = STATE.media_items()
    settings = STATE.settings
    role_name = settings.get("role_name", "EVA")
    role_repository = STATE.role_repository_root()
    eva_running = STATE.embedded_mode or (STATE.eva_process is not None and STATE.eva_process.poll() is None)
    vosk_ready = vosk_model_dir().exists()
    microphones = microphone_devices()
    selected_microphone = settings.get("microphone_device", "")
    client_port = parse_port(settings.get("client_port"), 8080)
    client_address = get_base_url(client_port).removeprefix("http://").removeprefix("https://")
    log_text = "\n".join(STATE.logs)
    preset_buttons = "".join(
        f'<button name="preset" value="{h(key)}">{h(value["label"])}</button>'
        for key, value in THEME_PRESETS.items()
    )
    theme_inputs = "".join(
        render_theme_input(key, str(theme.get(key, "")))
        for key in ["title", "background", "surface", "surfaceAlt", "inputBackground", "text", "muted", "accent", "primary", "danger", "radius"]
    )
    user_rows = "".join(
        f"<tr><td>{h(user['name'])}</td><td>{h(', '.join(user.get('aliases', [])))}</td>"
        f'<td><form method="post" action="/players/delete"><input type="hidden" name="name" value="{h(user["name"])}"><button>Eliminar</button></form></td></tr>'
        for user in users
    )
    media_rows = "".join(
        f"<tr><td>{h(item['filename'])}</td><td>{h(item['type'])}</td><td>{h(item['aliases'])}</td>"
        f'<td><form method="post" action="/media/delete"><input type="hidden" name="filename" value="{h(item["filename"])}"><button>Eliminar</button></form></td></tr>'
        for item in media
    )
    microphone_options = '<option value="">Microfono por defecto</option>' + "".join(
        f'<option value="{h(device["id"])}" {"selected" if device["id"] == selected_microphone else ""}>{h(device["label"])}</option>'
        for device in microphones
    )
    if STATE.embedded_mode:
        runtime_controls = (
            '<span class="embedded-note">EVA se está ejecutando en modo integrado</span>'
        )
        reset_control = '<form class="actions" method="post" action="/client/reset"><button>Reset cliente</button></form>'
    else:
        runtime_controls = (
            '<form method="post" action="/start-eva"><button>Arrancar EVA</button></form>'
            '<form method="post" action="/stop-eva"><button>Detener EVA</button></form>'
        )
        reset_control = ""
    return f"""<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{APP_TITLE}</title>
  <style>
    :root {{ color-scheme: dark; --bg:#0d0f12; --panel:#171b22; --soft:#202733; --text:#ededed; --muted:#9fa7b3; --accent:#66ccff; --gold:#c9a24a; --danger:#d75f5f; }}
    * {{ box-sizing: border-box; }}
    body {{ margin:0; background:var(--bg); color:var(--text); font:14px/1.45 system-ui, -apple-system, Segoe UI, sans-serif; }}
    header {{ position:sticky; top:0; z-index:2; display:flex; justify-content:space-between; align-items:center; gap:16px; padding:14px 20px; background:#090b0f; border-bottom:1px solid #2b3543; }}
    h1 {{ margin:0; font-size:20px; }}
    main {{ display:grid; grid-template-columns: minmax(0, 1fr) 390px; gap:16px; padding:16px; }}
    section {{ background:var(--panel); border:1px solid #2b3543; border-radius:8px; padding:14px; margin-bottom:16px; }}
    h2 {{ margin:0 0 12px; font-size:15px; color:var(--gold); text-transform:uppercase; }}
    form.grid, .grid {{ display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px; }}
    label {{ display:grid; gap:5px; color:var(--muted); font-size:12px; font-weight:800; }}
    input, textarea, select {{ width:100%; min-height:36px; border:1px solid #394554; border-radius:6px; background:#0c1016; color:var(--text); padding:8px 9px; }}
    input[type="color"] {{ width:44px; min-width:44px; height:36px; min-height:36px; padding:2px; cursor:pointer; }}
    input[type="file"].drop-input {{ position:absolute; width:1px; height:1px; opacity:0; pointer-events:none; }}
    textarea {{ min-height:94px; resize:vertical; }}
    .color-field {{ display:grid; grid-template-columns:44px minmax(0, 1fr); gap:8px; align-items:center; }}
    .drop-zone {{ min-height:138px; display:grid; place-items:center; gap:8px; padding:18px; border:1px dashed #52667d; border-radius:8px; background:#0c1016; color:var(--muted); text-align:center; cursor:pointer; transition:border-color .16s ease, background .16s ease, color .16s ease; }}
    .drop-zone strong {{ color:var(--text); font-size:15px; }}
    .drop-zone.dragging {{ border-color:var(--accent); background:#102333; color:var(--text); }}
    .drop-status {{ margin:0; color:var(--muted); font-size:12px; font-weight:800; }}
    .drop-status.error {{ color:var(--danger); }}
    .file-preview-grid {{ grid-column:1 / -1; display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); gap:10px; }}
    .file-preview {{ position:relative; overflow:hidden; min-height:198px; display:grid; grid-template-rows:118px auto; border:1px solid #394554; border-radius:8px; background:#0c1016; }}
    .file-preview-media {{ position:relative; display:grid; place-items:center; min-width:0; min-height:0; background:#05070a; color:var(--muted); font-size:12px; font-weight:900; text-align:center; }}
    .file-preview-media img, .file-preview-media video {{ width:100%; height:100%; object-fit:cover; display:block; }}
    .file-preview-media audio {{ width:calc(100% - 14px); }}
    .file-preview-caption {{ position:absolute; inset:auto 0 0 0; min-width:0; display:grid; gap:4px; padding:34px 10px 10px; isolation:isolate; }}
    .file-preview-caption::before {{ content:""; position:absolute; inset:0; z-index:0; pointer-events:none; background:linear-gradient(180deg, rgba(5,7,10,0) 0%, rgba(5,7,10,.18) 28%, rgba(5,7,10,.78) 72%, rgba(5,7,10,.96) 100%); }}
    .file-preview-caption > * {{ position:relative; z-index:1; }}
    .file-preview-body {{ min-width:0; display:grid; gap:7px; padding:10px 9px 9px; background:#0c1016; }}
    .file-preview-name {{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text); font-weight:900; }}
    .file-preview-meta {{ color:var(--muted); font-size:12px; }}
    .file-preview-fields {{ display:grid; gap:7px; }}
    .file-preview-fields input {{ min-height:32px; padding:7px 8px; font-size:13px; }}
    .remove-file {{ position:absolute; top:7px; right:7px; width:30px; min-width:30px; min-height:30px; padding:0; border-color:#6d3b45; background:#3a151b; }}
    button, a.button {{ min-height:36px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #52667d; border-radius:6px; background:#1b2a38; color:var(--text); padding:8px 11px; text-decoration:none; font-weight:800; cursor:pointer; }}
    button.primary {{ background:#1f4f66; border-color:var(--accent); }}
    button:hover, a.button:hover {{ border-color:var(--accent); }}
    .actions {{ display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }}
    .client-share {{ grid-column:1 / -1; display:grid; grid-template-columns:minmax(0, 1fr) auto; gap:6px 10px; align-items:center; padding:11px; border:1px solid #394554; border-radius:8px; background:#0c1016; }}
    .client-share span {{ grid-column:1 / -1; color:var(--muted); font-size:12px; font-weight:800; }}
    .client-share strong {{ min-width:0; overflow:hidden; color:var(--accent); font-size:16px; text-overflow:ellipsis; white-space:nowrap; }}
    .client-share button {{ min-width:98px; }}
    .embedded-note {{ min-height:36px; display:inline-flex; align-items:center; color:var(--muted); font-weight:800; }}
    .hint {{ margin:8px 0 0; color:var(--muted); font-size:12px; font-weight:800; }}
    table {{ width:100%; border-collapse:collapse; }}
    th, td {{ border-bottom:1px solid #2b3543; padding:8px; text-align:left; vertical-align:top; }}
    th {{ color:var(--muted); font-size:12px; text-transform:uppercase; }}
    pre {{ min-height:360px; max-height:calc(100vh - 170px); overflow:auto; margin:0; padding:12px; background:#05070a; border:1px solid #2b3543; border-radius:8px; white-space:pre-wrap; }}
    .status {{ color:{'#77dd99' if eva_running else '#d75f5f'}; font-weight:900; }}
    .span2 {{ grid-column:1 / -1; }}
    @media (max-width: 980px) {{ main {{ grid-template-columns:1fr; }} }}
  </style>
</head>
<body>
<header>
  <div><h1>Launcher EVA</h1><div class="status">EVA {'arrancada' if eva_running else 'detenida'}</div></div>
  <div class="actions">
    <a class="button" href="http://localhost:{h(settings.get('web_port', '8000'))}/" target="_blank">Abrir EVA</a>
    <a class="button" href="http://localhost:{h(settings.get('client_port', '8080'))}/" target="_blank">Abrir jugadores</a>
    {runtime_controls}
  </div>
</header>
<main>
  <div>
    <section>
      <h2>Rol y release</h2>
      <form class="grid" method="post" action="/settings">
        <label>Título del rol visible para jugadores<input name="role_name" value="{h(role_name)}"></label>
        <label class="span2">Repositorio del rol<input value="{h(role_repository)}" readonly></label>
        <label class="span2">Subtítulo app<input name="app_subtitle" value="{h(settings.get('app_subtitle', 'EVA mantiene el vinculo abierto'))}"></label>
        <label>Puerto EVA/configurador<input name="web_port" value="{h(settings.get('web_port', '8000'))}"></label>
        <label>Puerto web de jugadores<input name="client_port" value="{h(settings.get('client_port', '8080'))}"></label>
        <label>Máximo backups SQLite<input name="db_max_backups" type="number" min="0" step="1" value="{h(settings.get('db_max_backups', '10'))}"></label>
        <div class="client-share">
          <span>La aplicación para los jugadores está desplegada en:</span>
          <strong id="configClientAddress">{h(client_address)}</strong>
          <button type="button" data-copy-client-address="{h(client_address)}">Copiar</button>
        </div>
        <label class="span2">Microfono EVA<select name="microphone_device">{microphone_options}</select></label>
        <div class="actions span2"><button class="primary">Guardar configuración y propagar</button></div>
      </form>
      <form class="actions" method="post" action="/pull">
        <button name="target" value="both">Pull public_release</button>
      </form>
      <p class="hint">Modelo de voz: {'listo' if vosk_ready else 'descargando en segundo plano'}.</p>
      <form class="actions" method="post" action="/open-data-folder"><button>Abrir carpeta de datos</button></form>
      <form class="actions" method="post" action="/apply-release"><button>Reaplicar configuración</button></form>
      {reset_control}
      <form class="actions" method="post" action="/prepare-workflow"><button class="primary">Preparar workflow completo</button></form>
    </section>

    <section>
      <h2>Tema EVA</h2>
      <form class="actions" method="post" action="/theme/preset">{preset_buttons}</form>
      <form class="grid" method="post" action="/theme" enctype="multipart/form-data">{theme_inputs}<div class="actions span2"><button>Guardar tema</button></div></form>
    </section>

    <section>
      <h2>Jugadores</h2>
      <form class="grid" method="post" action="/players/add">
        <label>Nombre<input name="name"></label>
        <label>Alias separados por coma<input name="aliases"></label>
        <div class="actions span2"><button>Guardar jugador</button></div>
      </form>
      <table><thead><tr><th>Nombre</th><th>Alias</th><th></th></tr></thead><tbody>{user_rows}</tbody></table>
    </section>

    <section>
      <h2>Archivos</h2>
      <form id="mediaUploadForm" class="grid" method="post" action="/media/upload" enctype="multipart/form-data">
        <label class="span2">Archivos
          <span id="mediaDropZone" class="drop-zone">
            <strong>Suelta archivos aquí</strong>
            <span>o pulsa para seleccionarlos</span>
            <small>Imágenes, vídeo, audio, PDF y markdown</small>
          </span>
          <input id="mediaFileInput" class="drop-input" type="file" name="file" multiple>
        </label>
        <p id="mediaDropStatus" class="drop-status span2">Sin archivos seleccionados.</p>
        <div id="mediaSelectedFiles" class="file-preview-grid"></div>
        <div class="actions span2"><button>Subir a media</button></div>
      </form>
      <table><thead><tr><th>Archivo</th><th>Tipo</th><th>Alias</th><th></th></tr></thead><tbody>{media_rows}</tbody></table>
    </section>

    <section>
      <h2>Bromas rápidas</h2>
      <form class="grid" method="post" action="/jokes/add">
        <label>Nombre<input name="name"></label>
        <label>Alias separados por coma<input name="aliases"></label>
        <label class="span2">Texto<textarea name="text"></textarea></label>
        <div class="actions span2"><button>Crear markdown en media</button></div>
      </form>
    </section>

    <section>
      <h2>Música de intro</h2>
      <form class="grid" method="post" action="/intro/upload" enctype="multipart/form-data">
        <label>MP3<input type="file" name="file" accept=".mp3,audio/mpeg"></label>
        <div class="actions"><button>Usar como despertar.mp3</button></div>
      </form>
    </section>
  </div>
  <aside>
    <section>
      <h2>Logs</h2>
      <pre>{h(log_text)}</pre>
    </section>
  </aside>
</main>
<script>
  document.querySelectorAll("[data-color-target]").forEach((picker) => {{
    const name = picker.dataset.colorTarget;
    const text = document.querySelector(`[data-color-name="${{name}}"]`);
    if (!text) return;

    picker.addEventListener("input", () => {{
      text.value = picker.value;
    }});

    text.addEventListener("input", () => {{
      if (/^#[0-9a-fA-F]{{6}}$/.test(text.value.trim())) {{
        picker.value = text.value.trim();
      }}
    }});
  }});
  const dropZone = document.getElementById("mediaDropZone");
  const fileInput = document.getElementById("mediaFileInput");
  const uploadForm = document.getElementById("mediaUploadForm");
  const dropStatus = document.getElementById("mediaDropStatus");
  const selectedFiles = document.getElementById("mediaSelectedFiles");
  let selectedMediaFiles = [];
  let selectedMediaMeta = [];
  let previewUrls = [];
  function revokePreviewUrls() {{
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    previewUrls = [];
  }}
  function formatBytes(bytes) {{
    if (bytes < 1024) return `${{bytes}} B`;
    if (bytes < 1024 * 1024) return `${{Math.ceil(bytes / 1024)}} KB`;
    return `${{(bytes / (1024 * 1024)).toFixed(1)}} MB`;
  }}
  function escapeHtml(value) {{
    return String(value).replace(/[&<>"']/g, (char) => ({{
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }}[char]));
  }}
  function syncFileInput() {{
    if (!fileInput) return;
    const transfer = new DataTransfer();
    selectedMediaFiles.forEach((file) => transfer.items.add(file));
    fileInput.files = transfer.files;
  }}
  function addFiles(files) {{
    const existing = new Set(selectedMediaFiles.map((file) => `${{file.name}}:${{file.size}}:${{file.lastModified}}`));
    Array.from(files || []).forEach((file) => {{
      const key = `${{file.name}}:${{file.size}}:${{file.lastModified}}`;
      if (!existing.has(key)) {{
        selectedMediaFiles.push(file);
        selectedMediaMeta.push({{
          name: file.name.replace(/\\.[^.]+$/, "").replace(/[_-]+/g, " "),
          aliases: "",
        }});
        existing.add(key);
      }}
    }});
    syncFileInput();
    renderSelectedFiles();
  }}
  function removeFile(index) {{
    selectedMediaFiles.splice(index, 1);
    selectedMediaMeta.splice(index, 1);
    syncFileInput();
    renderSelectedFiles();
  }}
  function previewFor(file) {{
    const url = URL.createObjectURL(file);
    previewUrls.push(url);
    if (file.type.startsWith("image/")) {{
      return `<img src="${{url}}" alt="">`;
    }}
    if (file.type.startsWith("video/")) {{
      return `<video src="${{url}}" muted playsinline></video>`;
    }}
    if (file.type.startsWith("audio/")) {{
      return `<audio src="${{url}}" controls></audio>`;
    }}
    if (file.type === "application/pdf") {{
      return "PDF";
    }}
    if (file.type.startsWith("text/") || /\\.(md|txt|json)$/i.test(file.name)) {{
      return "TEXTO";
    }}
    return escapeHtml(file.name.split(".").pop()?.toUpperCase() || "ARCHIVO");
  }}
  function renderSelectedFiles() {{
    if (!selectedFiles || !dropStatus) return;
    revokePreviewUrls();
    selectedFiles.innerHTML = "";
    dropStatus.classList.remove("error");
    dropStatus.textContent = selectedMediaFiles.length
      ? `${{selectedMediaFiles.length}} archivo(s) listos para subir.`
      : "Sin archivos seleccionados.";
    selectedMediaFiles.forEach((file, index) => {{
      const card = document.createElement("div");
      card.className = "file-preview";
      const safeName = escapeHtml(file.name);
      const safeType = escapeHtml(file.type || "archivo");
      const meta = selectedMediaMeta[index] || {{ name: "", aliases: "" }};
      card.innerHTML = `
        <div class="file-preview-media">
          ${{previewFor(file)}}
          <div class="file-preview-caption">
            <div class="file-preview-name" title="${{safeName}}">${{safeName}}</div>
            <div class="file-preview-meta">${{safeType}} · ${{formatBytes(file.size)}}</div>
          </div>
        </div>
        <div class="file-preview-body">
          <div class="file-preview-fields">
            <label>Nombre visible<input name="name_${{index}}" value="${{escapeHtml(meta.name)}}" placeholder="Nombre visible"></label>
            <label>Aliases<input name="aliases_${{index}}" value="${{escapeHtml(meta.aliases)}}" placeholder="alias 1, alias 2"></label>
          </div>
        </div>
        <button class="remove-file" type="button" aria-label="Quitar ${{safeName}}">×</button>
      `;
      card.querySelector(`[name="name_${{index}}"]`).addEventListener("input", (event) => {{
        selectedMediaMeta[index].name = event.target.value;
      }});
      card.querySelector(`[name="aliases_${{index}}"]`).addEventListener("input", (event) => {{
        selectedMediaMeta[index].aliases = event.target.value;
      }});
      card.querySelector(".remove-file").addEventListener("click", () => removeFile(index));
      selectedFiles.appendChild(card);
    }});
  }}
  if (dropZone && fileInput) {{
    dropZone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => addFiles(fileInput.files));
    ["dragenter", "dragover"].forEach((eventName) => {{
      dropZone.addEventListener(eventName, (event) => {{
        event.preventDefault();
        dropZone.classList.add("dragging");
      }});
    }});
    ["dragleave", "drop"].forEach((eventName) => {{
      dropZone.addEventListener(eventName, (event) => {{
        event.preventDefault();
        dropZone.classList.remove("dragging");
      }});
    }});
    dropZone.addEventListener("drop", (event) => {{
      if (event.dataTransfer?.files?.length) {{
        addFiles(event.dataTransfer.files);
      }}
    }});
    uploadForm?.addEventListener("submit", (event) => {{
      if (!selectedMediaFiles.length) {{
        event.preventDefault();
        dropStatus.textContent = "Selecciona o suelta archivos primero.";
        dropStatus.classList.add("error");
      }}
    }});
  }}
  document.querySelectorAll("[data-copy-client-address]").forEach((button) => {{
    button.addEventListener("click", async () => {{
      const text = button.dataset.copyClientAddress || "";
      try {{
        await navigator.clipboard.writeText(text);
      }} catch (error) {{
        const input = document.createElement("input");
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }}
      button.textContent = "Copiado";
      setTimeout(() => {{ button.textContent = "Copiar"; }}, 1400);
    }});
  }});
</script>
</body>
</html>"""


def create_server() -> tuple[ThreadingHTTPServer, str]:
    port = find_free_port(PORT)
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}/"
    STATE.log(f"Launcher abierto en {url}")
    return server, url


def shutdown_server(server: ThreadingHTTPServer) -> None:
    if STATE.eva_process and STATE.eva_process.poll() is None:
        STATE.stop_eva()
    server.shutdown()
    server.server_close()


def main(open_browser: bool = True) -> None:
    server, url = create_server()
    if open_browser:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        if STATE.eva_process and STATE.eva_process.poll() is None:
            STATE.stop_eva()
        server.server_close()


def find_free_port(start_port: int) -> int:
    for port in range(start_port, start_port + 40):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                probe.bind(("127.0.0.1", port))
            except OSError:
                continue
            return port
    raise OSError(f"No hay puertos libres entre {start_port} y {start_port + 39}.")


if __name__ == "__main__":
    main()
