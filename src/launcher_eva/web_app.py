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
import urllib.request
import webbrowser
import zipfile
import socket
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


APP_TITLE = "Launcher EVA"
PUBLIC_BRANCH = "public_release"
CONFIG_FILE = "launcher.config.json"
PORT = 8787
SNAPSHOT_ROOT = "managed_releases"
VOSK_MODEL_DIR = "vosk-model-es-0.42"
VOSK_MODEL_ZIP = "vosk-model-es-0.42.zip"
VOSK_MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-es-0.42.zip"

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

THEME_PRESETS = {
    "eva": {
        "label": "EVA oscuro",
        "theme": {
            "title": "Panel de Control EVA",
            "background": "#0d0f12",
            "surface": "#1a1f27",
            "surfaceAlt": "#111419",
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
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[2]


def runtime_assets_root() -> Path:
    return app_root() / "assets"


def runtime_sqlite_path() -> Path:
    return app_root() / "eva.sqlite3"


def runtime_apks_root() -> Path:
    return app_root() / "apks"


def runtime_vendor_root() -> Path:
    return app_root() / "vendor"


def ensure_runtime_layout() -> None:
    runtime_assets_root().mkdir(parents=True, exist_ok=True)
    runtime_apks_root().mkdir(parents=True, exist_ok=True)


def bundled_root() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return app_root()


def seed_bundled_projects() -> None:
    source = bundled_root() / "projects"
    destination = app_root() / "projects"
    if not getattr(sys, "frozen", False) or not source.exists() or destination.exists():
        return
    shutil.copytree(source, destination, ignore=shutil.ignore_patterns(
        ".git",
        "__pycache__",
        "*.pyc",
    ))


def seed_bundled_vendor() -> None:
    source = bundled_root() / "vendor"
    destination = runtime_vendor_root()
    if not getattr(sys, "frozen", False) or not source.exists() or destination.exists():
        return
    shutil.copytree(source, destination, ignore=shutil.ignore_patterns(
        "__pycache__",
        "*.pyc",
    ))
    ensure_vendor_executable_bits(destination)


def ensure_vendor_executable_bits(vendor_root: Path) -> None:
    if os.name == "nt" or not vendor_root.exists():
        return
    executable_dirs = [
        vendor_root / "node" / "bin",
        vendor_root / "jdk" / "bin",
        vendor_root / "android-sdk" / "cmdline-tools" / "latest" / "bin",
        vendor_root / "android-sdk" / "platform-tools",
        vendor_root / "android-sdk" / "build-tools",
    ]
    for directory in executable_dirs:
        if not directory.exists():
            continue
        for path in directory.rglob("*"):
            if path.is_file():
                try:
                    path.chmod(path.stat().st_mode | 0o755)
                except OSError:
                    pass


def default_settings() -> dict:
    projects_root = app_root() / "projects"
    return {
        "role_name": "Horus",
        "app_subtitle": "EVA mantiene el vinculo abierto",
        "android_package": "com.eva.horus",
        "firebase_service_account_path": "",
        "google_services_path": "",
        "firebase_web_config_path": "",
        "eva_path": str(projects_root / "Asistente EVA"),
        "horus_path": str(projects_root / "horus"),
        "eva_remote": "",
        "horus_remote": "",
        "web_port": "8080",
        "horus_port": "8081",
        "microphone_device": "",
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


def package_slug(text: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "_", normalize(text)).strip("_") or "rol"
    if not value[0].isalpha():
        value = f"r_{value}"
    return value


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


def parse_firebase_web_file(path: Path) -> dict:
    data = load_json(path, {})
    if not isinstance(data, dict):
        return {}

    public = data.get("public")
    private = data.get("private")
    firebase_config = data.get("firebaseConfig") or data.get("config")

    if isinstance(public, dict):
        firebase_config = public.get("firebaseConfig") or public.get("config") or firebase_config
        public = public.get("vapidPublicKey") or public.get("publicKey")

    return {
        "vapidPublicKey": str(public or "").strip(),
        "vapidPrivateKey": str(private or "").strip(),
        "firebaseConfig": firebase_config if isinstance(firebase_config, dict) else {},
    }


class LauncherState:
    def __init__(self):
        seed_bundled_projects()
        seed_bundled_vendor()
        ensure_vendor_executable_bits(runtime_vendor_root())
        ensure_runtime_layout()
        self.settings_path = app_root() / CONFIG_FILE
        self.settings = default_settings()
        loaded = load_json(self.settings_path, {})
        if isinstance(loaded, dict):
            self.settings.update(loaded)
        self.logs: list[str] = []
        self.events: queue.Queue[str] = queue.Queue()
        self.eva_process: subprocess.Popen | None = None
        self.lock = threading.Lock()

    def log(self, message: str) -> None:
        line = f"[{time.strftime('%H:%M:%S')}] {message}"
        with self.lock:
            self.logs.append(line)
            self.logs = self.logs[-600:]
        print(line)

    def save_settings(self, form: dict[str, str]) -> None:
        for key in [
            "role_name",
            "app_subtitle",
            "android_package",
            "firebase_service_account_path",
            "google_services_path",
            "firebase_web_config_path",
            "eva_path",
            "horus_path",
            "eva_remote",
            "horus_remote",
            "web_port",
            "horus_port",
            "microphone_device",
        ]:
            if key in form:
                self.settings[key] = form[key].strip()
        if not self.settings.get("android_package"):
            self.settings["android_package"] = f"com.eva.{package_slug(self.settings.get('role_name', 'rol'))}"
        save_json(self.settings_path, self.settings)
        self.log("Configuración del launcher guardada.")
        self.apply_release_configuration()

    def eva_path(self) -> Path:
        return Path(self.settings["eva_path"]).expanduser()

    def horus_path(self) -> Path:
        return Path(self.settings["horus_path"]).expanduser()

    def eva_config_path(self) -> Path:
        return self.eva_path() / "config" / "eva.config.json"

    def media_root(self) -> Path:
        return runtime_assets_root()

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
        vendor_root = runtime_vendor_root()
        path_parts = []
        for candidate in [
            vendor_root / "node" / "bin",
            vendor_root / "jdk" / "bin",
            vendor_root / "android-sdk" / "cmdline-tools" / "latest" / "bin",
            vendor_root / "android-sdk" / "platform-tools",
        ]:
            if candidate.exists():
                path_parts.append(str(candidate))
        if path_parts:
            env["PATH"] = os.pathsep.join([*path_parts, env.get("PATH", "")])
        if (vendor_root / "jdk").exists():
            env["JAVA_HOME"] = str(vendor_root / "jdk")
        if (vendor_root / "android-sdk").exists():
            env["ANDROID_HOME"] = str(vendor_root / "android-sdk")
            env["ANDROID_SDK_ROOT"] = str(vendor_root / "android-sdk")
            env["ANDROID_USER_HOME"] = str(app_root() / ".android")
        env["GRADLE_USER_HOME"] = str(app_root() / ".gradle")
        env["EVA_DB_PATH"] = str(runtime_sqlite_path())
        env["EVA_MEDIA_ROOT"] = str(runtime_assets_root())
        return env

    def run_command(self, command: list[str], cwd: Path, label: str) -> int:
        self.log(f"$ {' '.join(command)} [{cwd}]")
        try:
            process = subprocess.Popen(
                command,
                cwd=str(cwd),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
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
        return app_root() / SNAPSHOT_ROOT / "current"

    def timestamped_release_root(self) -> Path:
        return app_root() / SNAPSHOT_ROOT / datetime.now().strftime("%Y%m%d-%H%M%S")

    def snapshot_ignore(self, directory: str, names: list[str]) -> set[str]:
        ignored = {
            ".git",
            ".venv",
            "__pycache__",
            "node_modules",
            ".expo",
            "dist",
            "build",
            ".gradle",
            ".kotlin",
            ".idea",
            ".vscode",
            VOSK_MODEL_DIR,
            VOSK_MODEL_ZIP,
        }
        if Path(directory).name in {"android", "ios"}:
            ignored.update({"build", ".gradle", "local.properties"})
        return {name for name in names if name in ignored or name.endswith(".pyc")}

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

        eva_metadata = self.snapshot_project("EVA", self.eva_path(), timestamp_root / "Asistente EVA")
        horus_metadata = self.snapshot_project("Horus", self.horus_path(), timestamp_root / "horus")

        for source_name, target_name in [("Asistente EVA", "Asistente EVA"), ("horus", "horus")]:
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
            "horus": horus_metadata,
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
        eva_path = self.eva_path()
        model_dir = eva_path / VOSK_MODEL_DIR
        zip_path = eva_path / VOSK_MODEL_ZIP
        if model_dir.exists():
            self.log(f"[EVA] Modelo Vosk ya disponible: {model_dir}.")
            return

        self.log(f"[EVA] Descargando modelo Vosk desde {VOSK_MODEL_URL}.")
        try:
            with urllib.request.urlopen(VOSK_MODEL_URL) as response, zip_path.open("wb") as output:
                shutil.copyfileobj(response, output)
        except OSError as error:
            self.log(f"[EVA] Error descargando Vosk: {error}")
            return

        self.log("[EVA] Descomprimiendo modelo Vosk.")
        try:
            with zipfile.ZipFile(zip_path) as archive:
                archive.extractall(eva_path)
        except (OSError, zipfile.BadZipFile) as error:
            self.log(f"[EVA] Error descomprimiendo Vosk: {error}")
            return
        self.log(f"[EVA] Modelo Vosk instalado en {model_dir}.")

    def ensure_horus_dependencies(self) -> None:
        horus_path = self.horus_path()
        if not (horus_path / "package.json").exists():
            self.log("[Horus] No encuentro package.json; salto dependencias Node.")
            return
        if (horus_path / "package-lock.json").exists():
            self.run_command(["npm", "ci"], horus_path, "Horus")
        else:
            self.run_command(["npm", "install"], horus_path, "Horus")

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
        self.update_repo("EVA", self.eva_path(), self.settings.get("eva_remote", ""))
        self.update_repo("Horus", self.horus_path(), self.settings.get("horus_remote", ""))

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
            command = [executable, "main.py"]
        self.log(f"Arrancando EVA con {' '.join(command)}")
        self.eva_process = subprocess.Popen(
            command,
            cwd=eva_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
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
        self.log("EVA detenida.")

    def save_theme(self, form: dict[str, str]) -> None:
        keys = ["title", "background", "surface", "surfaceAlt", "text", "muted", "accent", "primary", "danger", "radius"]
        config = self.eva_config()
        config["theme"] = {key: form.get(key, "").strip() for key in keys}
        self.save_eva_config(config)
        self.log("Tema guardado en EVA.")
        self.apply_release_configuration()

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
        return self.settings.get("role_name", "").strip() or "Horus"

    def app_subtitle(self) -> str:
        return self.settings.get("app_subtitle", "").strip() or "EVA mantiene el vinculo abierto"

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
        }
        config["network"] = {
            "webPort": parse_port(self.settings.get("web_port"), 8080),
            "horusPort": parse_port(self.settings.get("horus_port"), 8081),
            "wsPort": 8765,
        }
        microphone_id = self.settings.get("microphone_device", "").strip()
        config["audio"] = {
            "inputDeviceId": microphone_id,
            "inputDeviceName": self.microphone_name(microphone_id),
        }
        firebase_config = config.get("firebase") if isinstance(config.get("firebase"), dict) else {}
        service_account = self.prepare_eva_service_account()
        if service_account:
            firebase_config["serviceAccountPath"] = service_account
        else:
            firebase_config.pop("serviceAccountPath", None)
        web_firebase = self.prepare_eva_firebase_web_config()
        if web_firebase:
            firebase_config["web"] = web_firebase
        config["firebase"] = firebase_config
        self.save_eva_config(config)

        self.write_horus_app_config(theme)
        self.write_horus_brand()
        self.write_horus_audio_assets()
        self.write_horus_theme(theme)
        self.prepare_horus_google_services()
        self.log("Configuración propagada a EVA y Horus.")

    def microphone_name(self, microphone_id: str) -> str:
        if not microphone_id:
            return ""

        for device in microphone_devices():
            if device["id"] == microphone_id:
                return device["name"]

        return ""

    def prepare_eva_service_account(self) -> str | None:
        source_text = self.settings.get("firebase_service_account_path", "").strip()
        if not source_text:
            return None
        source = Path(source_text).expanduser()
        if not source.exists() or not source.is_file():
            self.log(f"Firebase service account no encontrado: {source}")
            return None
        destination = self.eva_path() / "config" / "firebase-service-account.json"
        destination.parent.mkdir(parents=True, exist_ok=True)
        if source.resolve() != destination.resolve():
            shutil.copyfile(source, destination)
        return destination.as_posix()

    def prepare_eva_firebase_web_config(self) -> dict | None:
        source_text = self.settings.get("firebase_web_config_path", "").strip()
        if not source_text:
            return None

        source = Path(source_text).expanduser()
        if not source.exists() or not source.is_file():
            self.log(f"Firebase web JSON no encontrado: {source}")
            return None

        config = parse_firebase_web_file(source)
        if not config.get("vapidPublicKey"):
            self.log("Firebase web ignorado: falta clave pública VAPID.")
            return None

        missing = [
            key
            for key in ("apiKey", "projectId", "messagingSenderId", "appId")
            if not config.get("firebaseConfig", {}).get(key)
        ]
        if missing:
            self.log(f"Firebase web guardado, pero falta firebaseConfig: {', '.join(missing)}.")
        else:
            self.log("Firebase web configurado para Horus PWA.")

        return config

    def prepare_horus_google_services(self) -> None:
        destination = self.horus_path() / "google-services.json"
        legacy_destination = self.horus_path() / "android" / "app" / "google-services.json"
        source_text = self.settings.get("google_services_path", "").strip()
        if not source_text:
            if destination.exists():
                destination.unlink()
            if legacy_destination.exists():
                legacy_destination.unlink()
            self.log("google-services.json eliminado: Firebase de app no configurado.")
            return
        source = Path(source_text).expanduser()
        if not source.exists() or not source.is_file():
            self.log(f"google-services.json no encontrado: {source}")
            if destination.exists():
                destination.unlink()
            if legacy_destination.exists():
                legacy_destination.unlink()
            return
        destination.parent.mkdir(parents=True, exist_ok=True)
        if source.resolve() != destination.resolve():
            shutil.copyfile(source, destination)
        self.log("google-services.json configurado para Horus.")

    def horus_firebase_enabled(self) -> bool:
        source_text = self.settings.get("google_services_path", "").strip()
        if source_text and Path(source_text).expanduser().is_file():
            return True
        return (self.horus_path() / "google-services.json").is_file()

    def write_horus_app_config(self, theme: dict) -> None:
        horus_path = self.horus_path()
        app_json_path = horus_path / "app.json"
        package_json_path = horus_path / "package.json"
        role_name = self.role_name()
        slug = app_slug(role_name)
        package_name = self.settings.get("android_package", "").strip() or f"com.eva.{package_slug(role_name)}"
        background = theme.get("background", "#0D0F12")

        app_config = load_json(app_json_path, {})
        if not isinstance(app_config, dict):
            app_config = {}
        expo = app_config.setdefault("expo", {})
        expo["name"] = role_name
        expo["slug"] = slug
        extra = expo.setdefault("extra", {})
        if isinstance(extra, dict):
            eas = extra.get("eas")
            if isinstance(eas, dict):
                eas.pop("projectId", None)
            if eas == {}:
                extra.pop("eas", None)
            if extra == {}:
                expo.pop("extra", None)
        expo.setdefault("ios", {})["bundleIdentifier"] = package_name
        android = expo.setdefault("android", {})
        android["package"] = package_name
        android["icon"] = "./assets/icon.png"
        android.setdefault("adaptiveIcon", {})["foregroundImage"] = "./assets/adaptive-icon.png"
        if is_hex_color(str(background)):
            android["adaptiveIcon"]["backgroundColor"] = background
        permissions = [
            "android.permission.RECORD_AUDIO",
            "android.permission.MODIFY_AUDIO_SETTINGS",
        ]
        if self.horus_firebase_enabled():
            permissions.append("android.permission.POST_NOTIFICATIONS")
            android["googleServicesFile"] = "./google-services.json"
        else:
            android.pop("googleServicesFile", None)
        android["permissions"] = permissions
        expo.setdefault("web", {})["favicon"] = "./assets/favicon.png"
        plugins = expo.get("plugins")
        if not isinstance(plugins, list):
            plugins = []
        plugins = [
            plugin
            for plugin in plugins
            if (
                plugin if isinstance(plugin, str)
                else plugin[0] if isinstance(plugin, list) and plugin
                else ""
            ) not in {"@react-native-firebase/app", "@react-native-firebase/messaging"}
        ]
        if self.horus_firebase_enabled():
            plugins = ["@react-native-firebase/app", "@react-native-firebase/messaging", *plugins]
        expo["plugins"] = plugins
        for plugin in expo.get("plugins", []):
            if isinstance(plugin, list) and plugin and plugin[0] == "expo-splash-screen" and isinstance(plugin[1], dict):
                plugin[1]["image"] = "./assets/icon.png"
                if is_hex_color(str(background)):
                    plugin[1]["backgroundColor"] = background
                    plugin[1].setdefault("dark", {})["backgroundColor"] = background
        save_json(app_json_path, app_config)

        package_config = load_json(package_json_path, {})
        if isinstance(package_config, dict):
            package_config["name"] = slug
            save_json(package_json_path, package_config)

    def write_horus_brand(self) -> None:
        role_name = self.role_name()
        display_name = role_name.upper()
        brand_path = self.horus_path() / "src" / "config" / "brand.ts"
        brand_path.parent.mkdir(parents=True, exist_ok=True)
        brand_path.write_text(
            "export const APP_BRAND = {\n"
            f"  appName: {json.dumps(role_name, ensure_ascii=False)},\n"
            f"  displayName: {json.dumps(display_name, ensure_ascii=False)},\n"
            f"  loadingText: {json.dumps(f'Despertando a {display_name}...', ensure_ascii=False)},\n"
            f"  subtitle: {json.dumps(self.app_subtitle(), ensure_ascii=False)},\n"
            f"  audioFeedLabel: {json.dumps(f'{display_name} AUDIO FEED', ensure_ascii=False)},\n"
            f"  videoFeedLabel: {json.dumps(f'TRANSMISION {display_name}', ensure_ascii=False)},\n"
            "} as const;\n",
            encoding="utf-8",
        )

    def write_horus_audio_assets(self) -> None:
        config_path = self.horus_path() / "src" / "config" / "audioAssets.ts"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        assets = {
            "login": self.horus_path() / "assets" / "audio" / "login.mp3",
            "menu": self.horus_path() / "assets" / "audio" / "menu.mp3",
        }

        def asset_value(path: Path) -> str:
            if not path.exists():
                return "null"
            relative = os.path.relpath(path, config_path.parent).replace(os.sep, "/")
            return f"require({json.dumps(relative)})"

        config_path.write_text(
            "// Generado por Launcher EVA.\n\n"
            "export const HORUS_AUDIO_ASSETS = {\n"
            f"  login: {asset_value(assets['login'])},\n"
            f"  menu: {asset_value(assets['menu'])},\n"
            "} as const;\n",
            encoding="utf-8",
        )

    def write_horus_theme(self, theme: dict) -> None:
        colors = {
            "background": theme.get("background", "#0D0F12"),
            "surface": theme.get("surface", "#E8E1D6"),
            "action": theme.get("danger", "#8B1E1E"),
            "premium": theme.get("accent", "#C9A24A"),
            "textDark": "#1A1A1A",
            "textLight": theme.get("text", "#EDEDED"),
            "neutralStone": theme.get("muted", "#6E6A64"),
            "neutralGold": theme.get("accent", "#D4AF37"),
            "borderLight": theme.get("surfaceAlt", "#D2C7B8"),
            "borderDark": "#262A30",
            "borderGold": theme.get("accent", "#C9A24A"),
            "success": "#3F6F4E",
            "warning": theme.get("accent", "#C9A24A"),
            "danger": theme.get("danger", "#8B1E1E"),
            "info": theme.get("primary", "#3E5F7A"),
        }
        for key, value in list(colors.items()):
            if not is_hex_color(str(value)):
                colors[key] = "#0D0F12"

        theme_path = self.horus_path() / "src" / "theme" / "theme.ts"
        theme_path.write_text(
            "// Generado por Launcher EVA.\n\n"
            "export const HORUS_COLORS = {\n"
            f"  background: {json.dumps(colors['background'])},\n"
            f"  surface: {json.dumps(colors['surface'])},\n"
            f"  action: {json.dumps(colors['action'])},\n"
            f"  premium: {json.dumps(colors['premium'])},\n"
            f"  textDark: {json.dumps(colors['textDark'])},\n"
            f"  textLight: {json.dumps(colors['textLight'])},\n"
            "  neutral: {\n"
            f"    stone: {json.dumps(colors['neutralStone'])},\n"
            f"    gold: {json.dumps(colors['neutralGold'])},\n"
            "  },\n"
            "  border: {\n"
            f"    light: {json.dumps(colors['borderLight'])},\n"
            f"    dark: {json.dumps(colors['borderDark'])},\n"
            f"    gold: {json.dumps(colors['borderGold'])},\n"
            "  },\n"
            "  status: {\n"
            f"    success: {json.dumps(colors['success'])},\n"
            f"    warning: {json.dumps(colors['warning'])},\n"
            f"    danger: {json.dumps(colors['danger'])},\n"
            f"    info: {json.dumps(colors['info'])},\n"
            "  },\n"
            "} as const;\n\n"
            "export const HORUS_THEME = {\n"
            "  colors: HORUS_COLORS,\n"
            "  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },\n"
            "  radius: { sm: 6, md: 10, lg: 16, xl: 22 },\n"
            "  fontSize: { xs: 12, sm: 14, md: 16, lg: 20, xl: 28 },\n"
            "  shadow: {\n"
            "    panel: {\n"
            "      shadowColor: \"#000000\",\n"
            "      shadowOpacity: 0.35,\n"
            "      shadowRadius: 10,\n"
            "      shadowOffset: { width: 0, height: 4 },\n"
            "      elevation: 6,\n"
            "    },\n"
            "  },\n"
            "} as const;\n",
            encoding="utf-8",
        )

    def set_horus_asset(self, upload_path: Path, original_name: str, asset_name: str) -> None:
        if Path(original_name).suffix.lower() not in {".png", ".jpg", ".jpeg"}:
            self.log("Los iconos/fotos de app deben ser PNG o JPG.")
            return
        destination = self.horus_path() / "assets" / asset_name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(upload_path, destination)
        self.log(f"Asset Horus actualizado: assets/{asset_name}.")

    def set_horus_audio(self, upload_path: Path, original_name: str, target: str) -> None:
        if target not in {"login", "menu"}:
            self.log("Audio Horus ignorado: destino desconocido.")
            return
        if Path(original_name).suffix.lower() != ".mp3":
            self.log("El audio de Horus debe ser MP3.")
            return
        destination = self.horus_path() / "assets" / "audio" / f"{target}.mp3"
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(upload_path, destination)
        self.write_horus_audio_assets()
        self.log(f"Audio Horus actualizado: assets/audio/{target}.mp3.")

    def delete_horus_audio(self, target: str) -> None:
        if target not in {"login", "menu"}:
            self.log("Audio Horus ignorado: destino desconocido.")
            return
        destination = self.horus_path() / "assets" / "audio" / f"{target}.mp3"
        destination.unlink(missing_ok=True)
        self.write_horus_audio_assets()
        self.log(f"Audio Horus eliminado: {target}.")

    def set_firebase_file(self, upload_path: Path, original_name: str, target: str) -> None:
        if Path(original_name).suffix.lower() != ".json":
            self.log("Firebase debe configurarse con archivos JSON.")
            return
        destination_root = app_root() / "firebase"
        destination_root.mkdir(parents=True, exist_ok=True)
        if target == "service":
            destination = destination_root / "firebase-service-account.json"
            setting = "firebase_service_account_path"
        elif target == "google":
            destination = destination_root / "google-services.json"
            setting = "google_services_path"
        else:
            destination = destination_root / "firebase-web.json"
            setting = "firebase_web_config_path"
        shutil.copyfile(upload_path, destination)
        self.settings[setting] = destination.as_posix()
        save_json(self.settings_path, self.settings)
        self.log(f"Firebase configurado: {destination.name}.")
        self.apply_release_configuration()

    def build_horus_release(self) -> None:
        self.apply_release_configuration()
        self.run_command(["npm", "run", "test"], self.horus_path(), "Horus")
        code = self.run_command(["npm", "run", "build:release"], self.horus_path(), "Horus")
        if code == 0:
            self.collect_horus_apks()

    def collect_horus_apks(self) -> None:
        outputs = self.horus_path() / "android" / "app" / "build" / "outputs"
        destination_root = runtime_apks_root() / "horus"
        destination_root.mkdir(parents=True, exist_ok=True)

        if not outputs.exists():
            self.log("[Horus] No encuentro outputs de Gradle para copiar APKs.")
            return

        copied = 0
        for source in outputs.rglob("*.apk"):
            destination = destination_root / source.name
            shutil.copyfile(source, destination)
            copied += 1
            self.log(f"[Horus] APK copiada: {destination}.")

        if copied == 0:
            self.log("[Horus] Build completado, pero no encontré APKs.")


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
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self):
        path = urlparse(self.path).path
        if path in {"/media/upload", "/intro/upload", "/horus/assets", "/horus/audio", "/firebase/upload"}:
            form, files = self.multipart()
        else:
            form = self.form()
            files = {}

        if path == "/settings":
            STATE.save_settings(form)
        elif path == "/pull":
            target = form.get("target", "both")
            if target == "eva":
                background(STATE.update_repo, "EVA", STATE.eva_path(), STATE.settings.get("eva_remote", ""))
            elif target == "horus":
                background(STATE.update_repo, "Horus", STATE.horus_path(), STATE.settings.get("horus_remote", ""))
            else:
                background(STATE.update_both)
        elif path == "/start-eva":
            background(STATE.start_eva)
        elif path == "/stop-eva":
            STATE.stop_eva()
        elif path == "/theme":
            STATE.save_theme(form)
        elif path == "/theme/preset":
            STATE.apply_preset(form.get("preset", "eva"))
        elif path == "/apply-release":
            STATE.apply_release_configuration()
        elif path == "/prepare-workflow":
            background(STATE.prepare_public_release_workflow)
        elif path == "/build/horus":
            background(STATE.build_horus_release)
        elif path == "/players/add":
            STATE.upsert_user(form.get("name", ""), form.get("aliases", ""))
        elif path == "/players/delete":
            STATE.delete_user(form.get("name", ""))
        elif path == "/media/upload":
            upload = files.get("file")
            if upload:
                STATE.add_media_upload(upload["path"], upload["filename"], form.get("name", ""), form.get("aliases", ""))
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
        elif path == "/horus/assets":
            for field, asset_name in [("icon", "icon.png"), ("adaptive", "adaptive-icon.png"), ("favicon", "favicon.png")]:
                upload = files.get(field)
                if upload:
                    STATE.set_horus_asset(upload["path"], upload["filename"], asset_name)
                    upload["path"].unlink(missing_ok=True)
            STATE.apply_release_configuration()
        elif path == "/horus/audio":
            for field in ["login", "menu"]:
                upload = files.get(field)
                if upload:
                    STATE.set_horus_audio(upload["path"], upload["filename"], field)
                    upload["path"].unlink(missing_ok=True)
            STATE.apply_release_configuration()
        elif path == "/horus/audio/delete":
            STATE.delete_horus_audio(form.get("target", ""))
            STATE.apply_release_configuration()
        elif path == "/firebase/upload":
            for field, target in [("service", "service"), ("google", "google"), ("web", "web")]:
                upload = files.get(field)
                if upload:
                    STATE.set_firebase_file(upload["path"], upload["filename"], target)
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
                item = item[-1]
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
    role_name = settings.get("role_name", "Horus")
    default_package = settings.get("android_package") or f"com.eva.{package_slug(role_name)}"
    eva_running = STATE.eva_process is not None and STATE.eva_process.poll() is None
    microphones = microphone_devices()
    selected_microphone = settings.get("microphone_device", "")
    horus_audio_login = STATE.horus_path() / "assets" / "audio" / "login.mp3"
    horus_audio_menu = STATE.horus_path() / "assets" / "audio" / "menu.mp3"
    log_text = "\n".join(STATE.logs[-180:])
    preset_buttons = "".join(
        f'<button name="preset" value="{h(key)}">{h(value["label"])}</button>'
        for key, value in THEME_PRESETS.items()
    )
    theme_inputs = "".join(
        render_theme_input(key, str(theme.get(key, "")))
        for key in ["title", "background", "surface", "surfaceAlt", "text", "muted", "accent", "primary", "danger", "radius"]
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
    textarea {{ min-height:94px; resize:vertical; }}
    .color-field {{ display:grid; grid-template-columns:44px minmax(0, 1fr); gap:8px; align-items:center; }}
    button, a.button {{ min-height:36px; display:inline-flex; align-items:center; justify-content:center; border:1px solid #52667d; border-radius:6px; background:#1b2a38; color:var(--text); padding:8px 11px; text-decoration:none; font-weight:800; cursor:pointer; }}
    button.primary {{ background:#1f4f66; border-color:var(--accent); }}
    button:hover, a.button:hover {{ border-color:var(--accent); }}
    .actions {{ display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }}
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
    <a class="button" href="http://localhost:{h(settings.get('web_port', '8080'))}/" target="_blank">Abrir EVA</a>
    <a class="button" href="http://localhost:{h(settings.get('horus_port', '8081'))}/" target="_blank">Abrir Horus</a>
    <form method="post" action="/start-eva"><button>Arrancar EVA</button></form>
    <form method="post" action="/stop-eva"><button>Detener EVA</button></form>
  </div>
</header>
<main>
  <div>
    <section>
      <h2>Rol y release</h2>
      <form class="grid" method="post" action="/settings">
        <label>Nombre del rol / app<input name="role_name" value="{h(role_name)}"></label>
        <label>Package Android<input name="android_package" value="{h(default_package)}"></label>
        <label class="span2">Subtítulo app<input name="app_subtitle" value="{h(settings.get('app_subtitle', 'EVA mantiene el vinculo abierto'))}"></label>
        <label>Firebase EVA service account<input name="firebase_service_account_path" value="{h(settings.get('firebase_service_account_path'))}"></label>
        <label>Firebase app google-services<input name="google_services_path" value="{h(settings.get('google_services_path'))}"></label>
        <label>Ruta EVA<input name="eva_path" value="{h(settings.get('eva_path'))}"></label>
        <label>Ruta Horus<input name="horus_path" value="{h(settings.get('horus_path'))}"></label>
        <label>Remote EVA opcional<input name="eva_remote" value="{h(settings.get('eva_remote'))}"></label>
        <label>Remote Horus opcional<input name="horus_remote" value="{h(settings.get('horus_remote'))}"></label>
        <label>Puerto web EVA<input name="web_port" value="{h(settings.get('web_port'))}"></label>
        <label>Puerto Horus PWA<input name="horus_port" value="{h(settings.get('horus_port', '8081'))}"></label>
        <label class="span2">Microfono EVA<select name="microphone_device">{microphone_options}</select></label>
        <div class="actions span2"><button class="primary">Guardar configuración y propagar</button></div>
      </form>
      <form class="grid" method="post" action="/horus/assets" enctype="multipart/form-data">
        <label>Icono app PNG/JPG<input type="file" name="icon" accept=".png,.jpg,.jpeg,image/png,image/jpeg"></label>
        <label>Icono adaptive PNG/JPG<input type="file" name="adaptive" accept=".png,.jpg,.jpeg,image/png,image/jpeg"></label>
        <label>Favicon web PNG/JPG<input type="file" name="favicon" accept=".png,.jpg,.jpeg,image/png,image/jpeg"></label>
        <div class="actions"><button>Guardar iconos Horus</button></div>
      </form>
      <form class="grid" method="post" action="/horus/audio" enctype="multipart/form-data">
        <label>MP3 login Horus <small>{'Configurado' if horus_audio_login.exists() else 'Sin audio'}</small><input type="file" name="login" accept=".mp3,audio/mpeg"></label>
        <label>MP3 menú Horus <small>{'Configurado' if horus_audio_menu.exists() else 'Sin audio'}</small><input type="file" name="menu" accept=".mp3,audio/mpeg"></label>
        <div class="actions span2"><button>Guardar audios Horus</button></div>
      </form>
      <form class="actions" method="post" action="/horus/audio/delete">
        <button name="target" value="login">Quitar audio login</button>
        <button name="target" value="menu">Quitar audio menú</button>
      </form>
      <form class="grid" method="post" action="/firebase/upload" enctype="multipart/form-data">
        <label>Service account EVA JSON<input type="file" name="service" accept=".json,application/json"></label>
        <label>google-services app JSON<input type="file" name="google" accept=".json,application/json"></label>
        <label class="span2">Firebase web / VAPID JSON<input type="file" name="web" accept=".json,application/json"></label>
        <div class="actions span2"><button>Guardar Firebase del rol</button></div>
      </form>
      <form class="actions" method="post" action="/pull">
        <button name="target" value="both">Pull ambos public_release</button>
        <button name="target" value="eva">Pull EVA</button>
        <button name="target" value="horus">Pull Horus</button>
      </form>
      <form class="actions" method="post" action="/apply-release"><button>Reaplicar configuración</button></form>
      <form class="actions" method="post" action="/prepare-workflow"><button class="primary">Preparar workflow completo</button></form>
      <form class="actions" method="post" action="/build/horus"><button class="primary">Generar release Horus</button></form>
    </section>

    <section>
      <h2>Tema EVA</h2>
      <form class="actions" method="post" action="/theme/preset">{preset_buttons}</form>
      <form class="grid" method="post" action="/theme">{theme_inputs}<div class="actions span2"><button>Guardar tema</button></div></form>
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
      <form class="grid" method="post" action="/media/upload" enctype="multipart/form-data">
        <label>Archivo<input type="file" name="file"></label>
        <label>Nombre visible<input name="name"></label>
        <label class="span2">Alias separados por coma<input name="aliases"></label>
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
