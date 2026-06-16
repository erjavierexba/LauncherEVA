from __future__ import annotations

from pathlib import Path
import json
import os
import re
import shutil
import unicodedata

MEDIA_ROOT = Path(os.environ.get("EVA_MEDIA_ROOT") or "media")
ALIASES_FILE = MEDIA_ROOT / "aliases.json"

ALLOWED_EXTENSIONS = {
    ".md": {
        "tipo": "TEXTO",
        "mime": "text/markdown",
    },
    ".png": {
        "tipo": "IMAGEN",
        "mime": "image/png",
    },
    ".mp4": {
        "tipo": "VIDEO",
        "mime": "video/mp4",
    },
    ".ogg": {
        "tipo": "AUDIO",
        "mime": "audio/ogg",
    },
    ".mp3": {
        "tipo": "AUDIO",
        "mime": "audio/mpeg",
    },
    ".wav": {
        "tipo": "AUDIO",
        "mime": "audio/wav",
    },
    ".webm": {
        "tipo": "VIDEO",
        "mime": "video/webm",
    },
    ".pdf": {
        "tipo": "DOCUMENTO",
        "mime": "application/pdf",
    },
}


def quitar_tildes(texto: str) -> str:
    return "".join(
        c
        for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )


def normalizar(texto: str) -> str:
    texto = quitar_tildes(texto.lower().strip())
    texto = texto.replace("_", " ")
    texto = re.sub(r"\s+", " ", texto)
    return texto.strip()


class MediaCatalog:
    def __init__(
        self,
        media_root=MEDIA_ROOT,
        base_url="http://192.168.0.18:8080",
        aliases_file=None,
    ):
        self.media_root = Path(media_root)
        self.base_url = base_url.rstrip("/")
        self.aliases_file = Path(aliases_file) if aliases_file else self.media_root / "aliases.json"

        self.aliases = self.load_aliases()

    def set_media_root(self, media_root):
        self.media_root = Path(media_root)
        self.aliases_file = self.media_root / "aliases.json"
        self.reload_aliases()

    def load_aliases(self) -> dict[str, str]:
        if not self.aliases_file.exists():
            print(f"[MEDIA] No existe archivo de aliases: {self.aliases_file}")
            return {}

        try:
            with self.aliases_file.open("r", encoding="utf-8") as file:
                data = json.load(file)

            if not isinstance(data, dict):
                print(f"[MEDIA] aliases.json debe ser un objeto JSON.")
                return {}

            aliases = {}

            for alias, filename in data.items():
                if not isinstance(alias, str) or not isinstance(filename, str):
                    print(f"[MEDIA] Alias inválido ignorado: {alias} -> {filename}")
                    continue

                aliases[normalizar(alias)] = filename.strip()

            print(f"[MEDIA] Aliases cargados: {len(aliases)}")
            return aliases

        except json.JSONDecodeError as error:
            print(f"[MEDIA] Error leyendo aliases.json: {error}")
            return {}

    def reload_aliases(self):
        self.aliases = self.load_aliases()

    def save_aliases(self, aliases: dict[str, str]):
        self.media_root.mkdir(parents=True, exist_ok=True)
        cleaned = {}

        for alias, filename in aliases.items():
            clean_alias = normalizar(str(alias))
            clean_filename = Path(str(filename)).name

            if clean_alias and clean_filename:
                cleaned[clean_alias] = clean_filename

        with self.aliases_file.open("w", encoding="utf-8") as file:
            json.dump(cleaned, file, ensure_ascii=False, indent=2)
            file.write("\n")

        self.aliases = cleaned

    def find(self, spoken_name: str):
        key = normalizar(spoken_name)

        # Recarga en cada búsqueda para poder editar el JSON sin reiniciar EVA.
        # Si prefieres máximo rendimiento, borra esta línea.
        self.reload_aliases()

        filename = self.aliases.get(key)

        if filename is None:
            filename = self.find_by_filename(key)

        if filename is None:
            return None

        path = self.media_root / filename

        if not path.exists():
            print(f"[MEDIA] El alias apunta a un archivo que no existe: {path}")
            return None

        extension = path.suffix.lower()
        config = ALLOWED_EXTENSIONS.get(extension)

        if config is None:
            print(f"[MEDIA] Extensión no permitida: {extension}")
            return None
        relative_path = path.relative_to(self.media_root).as_posix()

        return {
            "tipo": config["tipo"],
            "nombre": self.pretty_name(path.stem),
            "url": f"/media/{relative_path}",
            "baseUrl": self.base_url,
            "mime": config["mime"],
        }

    def find_by_filename(self, key: str):
        if not self.media_root.exists():
            return None

        for path in self.media_root.iterdir():
            if not path.is_file():
                continue

            if path.suffix.lower() not in ALLOWED_EXTENSIONS:
                continue

            stem = normalizar(path.stem)
            filename = normalizar(path.name)

            if key == stem or key == filename:
                return path.name

        return None

    def list(self):
        if not self.media_root.exists():
            return []

        self.reload_aliases()

        aliases_by_filename = {}

        for alias, filename in self.aliases.items():
            aliases_by_filename.setdefault(filename, []).append(alias)

        items = []

        for path in sorted(self.media_root.iterdir(), key=lambda item: item.name.lower()):
            if not path.is_file():
                continue

            extension = path.suffix.lower()
            config = ALLOWED_EXTENSIONS.get(extension)

            if config is None:
                continue

            relative_path = path.relative_to(self.media_root).as_posix()
            aliases = sorted(aliases_by_filename.get(path.name, []))

            items.append({
                "tipo": config["tipo"],
                "nombre": self.pretty_name(path.stem),
                "filename": path.name,
                "aliases": aliases,
                "selector": aliases[0] if aliases else path.stem,
                "url": f"/media/{relative_path}",
                "baseUrl": self.base_url,
                "mime": config["mime"],
            })

        return items

    def add_file(self, source_path: Path, display_name: str, aliases: list[str]):
        source_path = Path(source_path)
        extension = source_path.suffix.lower()

        if extension not in ALLOWED_EXTENSIONS:
            return {
                "ok": False,
                "mensaje": f"Extensión no permitida: {extension}",
            }

        self.media_root.mkdir(parents=True, exist_ok=True)
        base_name = slugify(display_name or source_path.stem) or source_path.stem
        filename = unique_filename(self.media_root, f"{base_name}{extension}")
        destination = self.media_root / filename
        shutil.copyfile(source_path, destination)

        self.reload_aliases()
        next_aliases = dict(self.aliases)

        for alias in aliases:
            clean_alias = normalizar(alias)

            if clean_alias:
                next_aliases[clean_alias] = filename

        next_aliases.setdefault(normalizar(display_name or source_path.stem), filename)
        self.save_aliases(next_aliases)

        return {
            "ok": True,
            "mensaje": f"Archivo {filename} añadido.",
            "archivo": self.find(filename),
            "filename": filename,
        }

    def delete_file(self, filename: str):
        clean_filename = Path(filename).name
        path = self.media_root / clean_filename

        if not path.exists() or not path.is_file():
            return {
                "ok": False,
                "mensaje": "Archivo no encontrado.",
            }

        path.unlink()
        self.reload_aliases()
        self.save_aliases({
            alias: target
            for alias, target in self.aliases.items()
            if target != clean_filename
        })

        return {
            "ok": True,
            "mensaje": f"Archivo {clean_filename} eliminado.",
        }

    def pretty_name(self, stem: str):
        return stem.replace("_", " ").capitalize()


def slugify(text: str):
    text = normalizar(text)
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = text.strip("_")
    return text or "archivo"


def unique_filename(directory: Path, filename: str):
    path = directory / filename

    if not path.exists():
        return filename

    stem = path.stem
    suffix = path.suffix
    counter = 2

    while True:
        candidate = f"{stem}_{counter}{suffix}"

        if not (directory / candidate).exists():
            return candidate

        counter += 1
