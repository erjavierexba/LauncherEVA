from __future__ import annotations

import json
from pathlib import Path

from src.domain.players import normalizar


CONFIG_PATH = Path("config/eva.config.json")

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
        "text": "#ededed",
        "muted": "#9fa7b3",
        "accent": "#c9a24a",
        "primary": "#66ccff",
        "danger": "#c65353",
        "radius": "8px",
    },
    "users": [],
}


class AppConfig:
    def __init__(self, path: Path = CONFIG_PATH):
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
        }

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

    return merged
