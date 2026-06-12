import os
import json
from pathlib import Path


TITLE = "EVA"
BODY = "Tienes una notificación pendiente"
DATA = {"type": "pending_notification"}

_initialized = False
_available = None


def _load_firebase_admin():
    try:
        import firebase_admin
        from firebase_admin import credentials, messaging
    except ImportError:
        return None, None, None

    return firebase_admin, credentials, messaging


def _credentials_path():
    env_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    if env_path:
        return Path(env_path)

    config_path = Path("config/eva.config.json")

    if config_path.exists():
        try:
            with config_path.open("r", encoding="utf-8") as file:
                config = json.load(file)
        except json.JSONDecodeError:
            config = {}

        firebase_config = config.get("firebase") if isinstance(config, dict) else None
        service_account = firebase_config.get("serviceAccountPath") if isinstance(firebase_config, dict) else None

        if service_account:
            return Path(str(service_account))

    return None


def _ensure_initialized():
    global _initialized, _available

    if _available is False:
        return None

    firebase_admin, credentials, messaging = _load_firebase_admin()

    if firebase_admin is None:
        if _available is None:
            print("[FCM] firebase-admin no instalado. Push desactivado.")
        _available = False
        return None

    if _initialized:
        return messaging

    path = _credentials_path()

    if path is None:
        if _available is None:
            print("[FCM] Firebase no configurado. Push desactivado.")
        _available = False
        return None

    if not path.exists():
        if _available is None:
            print(f"[FCM] Credenciales no encontradas en {path}. Push desactivado.")
        _available = False
        return None

    firebase_admin.initialize_app(credentials.Certificate(path))
    _initialized = True
    _available = True

    print("[FCM] Firebase Admin inicializado")

    return messaging


def send_pending_notification(tokens: list[str]):
    if not tokens:
        return {
            "ok": False,
            "success_count": 0,
            "failure_count": 0,
            "mensaje": "No hay tokens FCM registrados.",
        }

    messaging = _ensure_initialized()

    if messaging is None:
        return {
            "ok": False,
            "success_count": 0,
            "failure_count": 0,
            "mensaje": "FCM no disponible. Configura Firebase en el launcher.",
        }

    message = messaging.MulticastMessage(
        tokens=tokens,
        notification=messaging.Notification(
            title=TITLE,
            body=BODY,
        ),
        data=DATA,
        android=messaging.AndroidConfig(
            priority="high",
        ),
    )

    response = messaging.send_each_for_multicast(message)

    print(
        f"[FCM] Push enviado: {response.success_count} ok, "
        f"{response.failure_count} fallos"
    )

    return {
        "ok": response.success_count > 0,
        "success_count": response.success_count,
        "failure_count": response.failure_count,
        "mensaje": "Push enviado.",
    }
