from __future__ import annotations

import shutil
import threading
import urllib.request
import zipfile
from pathlib import Path

from src.services.app_paths import user_data_dir


VOSK_MODEL_DIR_NAME = "vosk-model-es-0.42"
VOSK_MODEL_ZIP_NAME = "vosk-model-es-0.42.zip"
VOSK_MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-es-0.42.zip"

_download_lock = threading.Lock()
_download_thread: threading.Thread | None = None
_last_error = ""


def vosk_model_dir() -> Path:
    return user_data_dir() / VOSK_MODEL_DIR_NAME


def vosk_model_zip_path() -> Path:
    return user_data_dir() / VOSK_MODEL_ZIP_NAME


def vosk_download_error() -> str:
    return _last_error


def ensure_vosk_model(log=print) -> bool:
    global _last_error

    model_dir = vosk_model_dir()
    zip_path = vosk_model_zip_path()
    model_dir.parent.mkdir(parents=True, exist_ok=True)

    if model_dir.exists():
        _last_error = ""
        return True

    log(f"[VOSK] Descargando modelo en {model_dir}.")
    try:
        with urllib.request.urlopen(VOSK_MODEL_URL, timeout=30) as response, zip_path.open("wb") as output:
            shutil.copyfileobj(response, output)
    except OSError as error:
        _last_error = str(error)
        log(f"[VOSK] Error descargando modelo: {error}")
        return False

    log("[VOSK] Descomprimiendo modelo.")
    try:
        with zipfile.ZipFile(zip_path) as archive:
            archive.extractall(model_dir.parent)
    except (OSError, zipfile.BadZipFile) as error:
        _last_error = str(error)
        log(f"[VOSK] Error descomprimiendo modelo: {error}")
        return False
    finally:
        zip_path.unlink(missing_ok=True)

    _last_error = ""
    log(f"[VOSK] Modelo listo en {model_dir}.")
    return True


def ensure_vosk_model_in_background(log=print) -> bool:
    global _download_thread

    if vosk_model_dir().exists():
        return False

    with _download_lock:
        if _download_thread and _download_thread.is_alive():
            return False

        _download_thread = threading.Thread(
            target=ensure_vosk_model,
            kwargs={"log": log},
            daemon=True,
            name="vosk-download",
        )
        _download_thread.start()
        return True
