from __future__ import annotations

import json
import os
import re
from pathlib import Path

from src.domain.players import normalizar
from src.services.app_paths import app_config_path, ensure_app_data_layout, resolve_data_relative


CONFIG_PATH = app_config_path()

DEFAULT_CONFIG = {
    "assistant": {
        "name": "EVA",
        "wakeWord": "eva",
    },
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
    "users": [],
    "project": {
        "roleName": "EVA",
        "appSubtitle": "EVA mantiene el vinculo abierto",
        "repository": "roles/eva",
    },
    "server": {
        "host": "0.0.0.0",
        "evaPort": 8000,
        "clientPort": 8080,
    },
    "database": {
        "maxBackups": 10,
    },
}


class AppConfig:
    def __init__(self, path: Path = CONFIG_PATH):
        ensure_app_data_layout()
        self.path = Path(path)
        self.data = self.load()

    def load(self):
        if not self.path.exists():
            self.save(DEFAULT_CONFIG)
            return json.loads(json.dumps(DEFAULT_CONFIG))

        try:
            with self.path.open("r", encoding="utf-8") as file:
                data = json.load(file)
        except json.JSONDecodeError:
            data = {}

        return merge_config(data)

    def save(self, data: dict | None = None):
        self.path.parent.mkdir(parents=True, exist_ok=True)

        if data is not None:
            self.data = merge_config(data)

        with self.path.open("w", encoding="utf-8") as file:
            json.dump(self.data, file, ensure_ascii=False, indent=2)
            file.write("\n")

    def public(self):
        return {
            "assistant": self.data["assistant"],
            "theme": self.data["theme"],
            "users": self.users(),
            "project": self.data["project"],
            "server": self.data["server"],
            "database": self.data["database"],
        }

    def role_name(self):
        return str(self.data.get("project", {}).get("roleName") or "EVA").strip() or "EVA"

    def role_slug(self):
        return slugify(self.role_name())

    def role_repository_root(self):
        repository = str(self.data.get("project", {}).get("repository") or "").strip()
        return resolve_data_relative(repository) if repository else resolve_data_relative(Path("roles") / self.role_slug())

    def role_media_root(self):
        return self.role_repository_root() / "media"

    def role_db_path(self):
        env_path = os.environ.get("EVA_DB_PATH")
        if env_path:
            return Path(env_path)

        return self.role_repository_root() / "eva.sqlite3"

    def max_db_backups(self):
        return int(self.data.get("database", {}).get("maxBackups", 10))

    def users(self):
        users = []

        for user in self.data.get("users", []):
            name = str(user.get("name", "")).strip()

            if not name:
                continue

            aliases = [
                str(alias).strip()
                for alias in user.get("aliases", [])
                if str(alias).strip()
            ]
            users.append({
                "name": name,
                "aliases": aliases,
            })

        return users

    def user_names(self):
        return [user["name"] for user in self.users()]

    def user_aliases(self):
        aliases = {}

        for user in self.users():
            aliases[normalizar(user["name"])] = user["name"]

            for alias in user["aliases"]:
                aliases[normalizar(alias)] = user["name"]

        return aliases

    def upsert_user(self, name: str, aliases: list[str] | None = None):
        clean_name = name.strip()

        if not clean_name:
            return False

        aliases = aliases or []
        normalized = normalizar(clean_name)
        users = [
            user
            for user in self.users()
            if normalizar(user["name"]) != normalized
        ]
        users.append({
            "name": clean_name,
            "aliases": sorted({alias.strip() for alias in aliases if alias.strip()}),
        })
        self.data["users"] = sorted(users, key=lambda user: user["name"].lower())
        self.save()

        return True

    def delete_user(self, name: str):
        normalized = normalizar(name)
        users = [
            user
            for user in self.users()
            if normalizar(user["name"]) != normalized
        ]

        if len(users) == len(self.users()):
            return False

        self.data["users"] = users
        self.save()

        return True


def merge_config(data: dict):
    merged = json.loads(json.dumps(DEFAULT_CONFIG))

    if isinstance(data.get("assistant"), dict):
        merged["assistant"].update(data["assistant"])

    if isinstance(data.get("theme"), dict):
        merged["theme"].update(data["theme"])

    if isinstance(data.get("users"), list):
        merged["users"] = data["users"]

    project_has_repository = False
    if isinstance(data.get("project"), dict):
        project = data["project"]
        for key in ("roleName", "appSubtitle"):
            if isinstance(project.get(key), str) and project[key].strip():
                merged["project"][key] = project[key].strip()
        if isinstance(project.get("repository"), str) and project["repository"].strip():
            merged["project"]["repository"] = project["repository"].strip()
            project_has_repository = True

    if not project_has_repository:
        merged["project"]["repository"] = str(Path("roles") / slugify(merged["project"]["roleName"]))

    if isinstance(data.get("server"), dict):
        server = data["server"]
        for key in ("host",):
            if isinstance(server.get(key), str) and server[key].strip():
                merged["server"][key] = server[key].strip()
        for key in ("evaPort", "clientPort"):
            port = parse_port(server.get(key))
            if port is not None:
                merged["server"][key] = port

    if isinstance(data.get("database"), dict):
        max_backups = parse_non_negative_int(data["database"].get("maxBackups"))
        if max_backups is not None:
            merged["database"]["maxBackups"] = max_backups

    apply_env_port(merged["server"], "evaPort", "EVA_PORT")
    apply_env_port(merged["server"], "clientPort", "EVA_CLIENT_PORT")
    apply_env_text(merged["server"], "host", "EVA_HOST")
    apply_env_non_negative_int(merged["database"], "maxBackups", "EVA_DB_MAX_BACKUPS")

    return merged


def parse_port(value):
    try:
        port = int(value)
    except (TypeError, ValueError):
        return None

    if 1 <= port <= 65535:
        return port

    return None


def apply_env_port(server: dict, key: str, env_name: str):
    port = parse_port(os.environ.get(env_name))
    if port is not None:
        server[key] = port


def apply_env_text(server: dict, key: str, env_name: str):
    value = os.environ.get(env_name)
    if value and value.strip():
        server[key] = value.strip()


def parse_non_negative_int(value):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None

    if parsed < 0:
        return None

    return parsed


def apply_env_non_negative_int(section: dict, key: str, env_name: str):
    value = parse_non_negative_int(os.environ.get(env_name))
    if value is not None:
        section[key] = value


def slugify(text: str):
    import unicodedata

    clean = "".join(
        char
        for char in unicodedata.normalize("NFD", str(text or "").lower().strip())
        if unicodedata.category(char) != "Mn"
    )
    return re.sub(r"[^a-z0-9]+", "_", clean).strip("_") or "rol"
