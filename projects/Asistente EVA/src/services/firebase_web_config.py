from __future__ import annotations


FIREBASE_WEB_KEYS = ("apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId")


def public_firebase_web_config(app_config):
    firebase = app_config.data.get("firebase")
    web = firebase.get("web") if isinstance(firebase, dict) else None

    if not isinstance(web, dict):
        return {
            "ok": False,
            "mensaje": "Firebase web no configurado en config/eva.config.json.",
        }

    vapid_key = str(
        web.get("vapidPublicKey")
        or web.get("public")
        or web.get("publicKey")
        or ""
    ).strip()
    firebase_config = normalized_firebase_config(web.get("firebaseConfig") or web.get("config"))

    if not vapid_key:
        return {
            "ok": False,
            "mensaje": "Falta firebase.web.vapidPublicKey en config/eva.config.json.",
        }

    missing_config = [
        key
        for key in ("apiKey", "projectId", "messagingSenderId", "appId")
        if not firebase_config or not firebase_config.get(key)
    ]

    return {
        "ok": True,
        "vapidKey": vapid_key,
        "firebaseConfig": firebase_config,
        "configured": not missing_config,
        "missing": missing_config,
    }


def normalized_firebase_config(value):
    if not isinstance(value, dict):
        return None

    return {
        key: item
        for key, item in value.items()
        if key in FIREBASE_WEB_KEYS and item
    }
