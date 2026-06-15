import asyncio
import json
import os
import re
import shutil
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

from aiohttp import web
from launcher_eva.web_app import STATE as LAUNCHER_STATE
from launcher_eva.web_app import render_page as render_launcher_page

from src.commands.musica import MUSIC_MAP
from src.domain.name_generator import FANTASY_RACE_LABELS, HUMAN_NAME_SETS, generate_names
from src.domain.players import normalizar
from src.services.network import get_base_url
from src.ws_server import start_ws_loop, stop_ws_loop, websocket_handler


BASE_DIR = Path(__file__).parent
HTML_PATH = BASE_DIR / "web" / "index.html"
CSS_PATH = BASE_DIR / "web" / "index.css"
WEB_ROOT = BASE_DIR / "web"
WEB_SCRIPTS_PATH = WEB_ROOT / "scripts"
WEB_STYLES_PATH = WEB_ROOT / "styles"
WEB_ASSETS_PATH = WEB_ROOT / "assets"
FAVICON_PATH = WEB_ASSETS_PATH / "eva_favicon.png"
INCLUDE_PATTERN = re.compile(r"<!--\s*@include\s+([a-zA-Z0-9_./-]+)\s*-->")
SCRIPT_PARTS = (
    "00-state-dom.js",
    "10-actions-loaders.js",
    "20-templates.js",
    "30-characters-rendering.js",
    "90-boot.js",
)


def render_html_partial(path: Path) -> str:
    resolved = path.resolve()
    web_root = WEB_ROOT.resolve()

    try:
        resolved.relative_to(web_root)
    except ValueError:
        raise ValueError(f"Include fuera de web: {path}")

    html = resolved.read_text(encoding="utf-8")

    def replace_include(match):
        return render_html_partial(WEB_ROOT / match.group(1))

    return INCLUDE_PATTERN.sub(replace_include, html)


def render_html(context, ws_url: str) -> str:
    html = render_html_partial(HTML_PATH)
    theme = context.config.data["theme"]
    assistant = context.config.data["assistant"]
    project = context.config.data.get("project", {})
    app_title = str(theme.get("title") or assistant.get("name") or "EVA")
    role_subtitle = str(project.get("roleName") or project.get("appSubtitle") or assistant.get("name") or "EVA")
    client_address = get_base_url(context.horus_port).removeprefix("http://").removeprefix("https://")

    return (
        html
        .replace("{{WS_URL}}", ws_url)
        .replace("{{SESSION_ID}}", str(context.session_id))
        .replace("{{APP_TITLE}}", app_title)
        .replace("{{ROLE_SUBTITLE}}", role_subtitle)
        .replace("{{CLIENT_ADDRESS}}", client_address)
        .replace("{{THEME_JSON}}", json.dumps(theme, ensure_ascii=False))
    )


def no_store_headers():
    return {"Cache-Control": "no-store"}


def normalize_user_or_broadcast(db, value: str):
    clean = value.strip()

    if clean.upper() == "TODOS" or normalizar(clean) in ("todos", "todas", "todo"):
        return "TODOS"

    user = db.players.get(clean)

    if user is None:
        return None

    return user["nombre"]


def parse_positive_int(value):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None

    if parsed <= 0:
        return None

    return parsed


def parse_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def music_catalog():
    items = []

    for contexto, canciones in MUSIC_MAP.items():
        for numero, path in sorted(canciones.items()):
            items.append({
                "contexto": contexto,
                "numero": numero,
                "path": path,
                "label": f"{contexto} {numero}",
            })

    return items


async def index(request):
    context = request.app["context"]
    ws_url = f"ws://{request.host.split(':')[0]}:{context.ws_port}/ws"

    return web.Response(
        text=render_html(context, ws_url),
        content_type="text/html",
        headers=no_store_headers(),
    )


async def api_config(request):
    context = request.app["context"]

    return web.json_response({
        "ok": True,
        "config": context.config.public(),
    })


async def api_users(request):
    context = request.app["context"]

    return web.json_response({
        "ok": True,
        "usuarios": context.db.players.all(),
    })


async def api_users_create(request):
    context = request.app["context"]

    try:
        body = await request.json()
    except Exception:
        return web.json_response({
            "ok": False,
            "mensaje": "JSON inválido.",
        }, status=400)

    name = str(body.get("name") or body.get("nombre") or "").strip()
    aliases = parse_aliases(body.get("aliases", []))
    result = context.db.players.create_user(name, aliases)

    if result["ok"]:
        context.config.upsert_user(name, aliases)

    return web.json_response(result, status=200 if result["ok"] else 400)


async def api_users_delete(request):
    context = request.app["context"]
    username = request.match_info["username"]
    user = context.db.players.get(username)

    if user is None:
        return web.json_response({
            "ok": False,
            "mensaje": "Usuario no encontrado.",
        }, status=404)

    context.db.players.delete_user(user["nombre"])
    context.config.delete_user(user["nombre"])

    return web.json_response({
        "ok": True,
        "mensaje": f"Usuario {user['nombre']} eliminado.",
    })


async def favicon(request):
    return web.FileResponse(FAVICON_PATH)


async def index_css(request):
    return web.FileResponse(CSS_PATH, headers=no_store_headers())


async def scripts_js(request):
    scripts = [
        (WEB_SCRIPTS_PATH / filename).read_text(encoding="utf-8")
        for filename in SCRIPT_PARTS
    ]
    return web.Response(
        text="\n\n".join(scripts),
        content_type="application/javascript",
        headers=no_store_headers(),
    )


async def config_index(request):
    sync_launcher_settings(request.app["context"])
    return web.Response(
        text=render_launcher_page(),
        content_type="text/html",
        headers=no_store_headers(),
    )


async def config_logs(request):
    return web.Response(
        text="\n".join(LAUNCHER_STATE.logs),
        content_type="text/plain",
        headers=no_store_headers(),
    )


def config_redirect():
    raise web.HTTPSeeOther("/config")


def sync_launcher_settings(context):
    LAUNCHER_STATE.embedded_mode = True
    project = context.config.data.get("project", {})
    server = context.config.data.get("server", {})
    if project.get("roleName"):
        LAUNCHER_STATE.settings["role_name"] = str(project["roleName"])
    if project.get("appSubtitle"):
        LAUNCHER_STATE.settings["app_subtitle"] = str(project["appSubtitle"])
    LAUNCHER_STATE.settings["web_port"] = str(server.get("evaPort", context.web_port))
    LAUNCHER_STATE.settings["client_port"] = str(server.get("clientPort", context.horus_port))


async def config_form(request):
    post = await request.post()
    return {key: str(value) for key, value in post.items() if isinstance(value, str)}


async def config_settings(request):
    LAUNCHER_STATE.save_settings(await config_form(request))
    config_redirect()


async def config_theme(request):
    LAUNCHER_STATE.save_theme(await config_form(request))
    request.app["context"].config.data = request.app["context"].config.load()
    config_redirect()


async def config_theme_preset(request):
    form = await config_form(request)
    LAUNCHER_STATE.apply_preset(form.get("preset", "eva"))
    request.app["context"].config.data = request.app["context"].config.load()
    config_redirect()


async def config_apply_release(request):
    LAUNCHER_STATE.apply_release_configuration()
    request.app["context"].config.data = request.app["context"].config.load()
    config_redirect()


async def config_client_reset(request):
    await api_client_reset(request)
    LAUNCHER_STATE.log("Reset enviado a la aplicación cliente.")
    config_redirect()


async def config_start_eva(request):
    LAUNCHER_STATE.log("EVA ya está arrancada en este proceso.")
    config_redirect()


async def config_stop_eva(request):
    LAUNCHER_STATE.log("Detén EVA con CTRL+C en la terminal donde se lanzó main.py.")
    config_redirect()


async def config_players_add(request):
    form = await config_form(request)
    LAUNCHER_STATE.upsert_user(form.get("name", ""), form.get("aliases", ""))
    request.app["context"].config.data = request.app["context"].config.load()
    config_redirect()


async def config_players_delete(request):
    form = await config_form(request)
    LAUNCHER_STATE.delete_user(form.get("name", ""))
    request.app["context"].config.data = request.app["context"].config.load()
    config_redirect()


async def config_media_upload(request):
    post = await request.post()
    uploads = [
        upload
        for upload in post.getall("file", [])
        if upload is not None and getattr(upload, "filename", "")
    ]
    for index, upload in enumerate(uploads):
        suffix = Path(upload.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
            shutil.copyfileobj(upload.file, temp)
            temp_path = Path(temp.name)
        try:
            LAUNCHER_STATE.add_media_upload(
                temp_path,
                upload.filename,
                str(post.get(f"name_{index}", "")),
                str(post.get(f"aliases_{index}", "")),
            )
        finally:
            temp_path.unlink(missing_ok=True)
    config_redirect()


async def config_media_delete(request):
    form = await config_form(request)
    LAUNCHER_STATE.delete_media(form.get("filename", ""))
    config_redirect()


async def config_jokes_add(request):
    form = await config_form(request)
    LAUNCHER_STATE.add_joke(form.get("name", ""), form.get("text", ""), form.get("aliases", ""))
    config_redirect()


async def config_intro_upload(request):
    post = await request.post()
    upload = post.get("file")
    if upload is not None and getattr(upload, "filename", ""):
        suffix = Path(upload.filename).suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
            shutil.copyfileobj(upload.file, temp)
            temp_path = Path(temp.name)
        try:
            LAUNCHER_STATE.set_intro_upload(temp_path, upload.filename)
        finally:
            temp_path.unlink(missing_ok=True)
    config_redirect()


async def login(request):
    db = request.app["context"].db

    try:
        body = await request.json()
    except Exception:
        return web.json_response({
            "ok": False,
            "mensaje": "JSON inválido.",
        }, status=400)

    username = normalize_user_or_broadcast(db, str(body.get("username", "")))

    if username is None or username == "TODOS":
        return web.json_response({
            "ok": False,
            "mensaje": "Usuario no reconocido.",
        }, status=404)

    return web.json_response({
        "ok": True,
        "username": username,
    })


async def load_user_state(request):
    db = request.app["context"].db
    username = normalize_user_or_broadcast(db, request.match_info["username"])

    if username is None or username == "TODOS":
        return web.json_response({
            "ok": False,
            "mensaje": "Usuario no reconocido.",
        }, status=404)

    user = db.players.get(username)
    sheet = db.character_templates.sheet_for_player(user["id"]) if user else None
    characters = []

    if user:
        characters = [
            {
                **character,
                "sheet": db.character_templates.sheet_for_character(character["id"]),
            }
            for character in db.players.characters_for_player(user["id"])
            if character["active"]
        ]

    return web.json_response({
        "ok": True,
        "user": user,
        "template": db.character_templates.active_template(),
        "sheet": sheet,
        "characters": characters,
    })


async def api_client_reset(request):
    context = request.app["context"]
    action = {
        "tipo": "CLIENT_RESET",
        "destinatario": "TODOS",
        "valor": {
            "sessionId": context.session_id,
            "requestedAt": datetime.now(timezone.utc).isoformat(),
        },
        "mensaje": "Reset de cliente solicitado.",
    }
    await context.ws_queue.put(action)

    return web.json_response({
        "ok": True,
        "mensaje": "Reset enviado a la aplicación cliente.",
        "accion": action,
    })


async def api_characters(request):
    context = request.app["context"]

    return web.json_response({
        "ok": True,
        "players": context.db.players.all(),
        "personajes": [
            {
                **character,
                "sheet": context.db.character_templates.sheet_for_character(character["id"]),
            }
            for character in context.db.players.all_characters()
        ],
        "template": context.db.character_templates.active_template(),
    })


async def api_status(request):
    context = request.app["context"]

    return web.json_response({
        "ok": True,
        "players": context.db.players.all(),
        "template": context.db.character_templates.active_template(),
        "personajes": [
            {
                **character,
                "sheet": context.db.character_templates.sheet_for_character(character["id"]),
            }
            for character in context.db.players.all_characters()
        ],
    })


async def api_characters_create(request):
    context = request.app["context"]

    try:
        body = await request.json()
    except Exception:
        return web.json_response({
            "ok": False,
            "mensaje": "JSON inválido.",
        }, status=400)

    fields = body.get("fields")
    if not isinstance(fields, dict):
        fields = {}

    player_id = parse_positive_int(body.get("playerId") or body.get("player_id"))
    if player_id is None:
        player_name = str(body.get("playerName") or body.get("username") or "").strip()
        player = context.db.players.get(player_name)
        player_id = player["id"] if player else None

    if player_id is None:
        return web.json_response({
            "ok": False,
            "mensaje": "Jugador no encontrado.",
        }, status=404)

    result = context.db.players.create_character(
        player_id,
        str(body.get("name") or body.get("nombre") or ""),
        str(body.get("role") or body.get("rol") or ""),
        fields,
        notes=str(body.get("notes") or body.get("notas") or ""),
        template_id=parse_positive_int(body.get("templateId") or body.get("template_id")),
    )

    if result["ok"]:
        await context.ws_queue.put(template_update_event(context.db))

    return web.json_response(result, status=200 if result["ok"] else 400)


async def api_character_update(request):
    context = request.app["context"]
    character_id = parse_positive_int(request.match_info["character_id"])

    if character_id is None:
        return web.json_response({
            "ok": False,
            "mensaje": "Personaje inválido.",
        }, status=400)

    try:
        body = await request.json()
    except Exception:
        return web.json_response({
            "ok": False,
            "mensaje": "JSON inválido.",
        }, status=400)

    result = context.db.players.update_character(
        character_id,
        name=body.get("name") if "name" in body else body.get("nombre"),
        notes=body.get("notes") if "notes" in body else body.get("notas"),
        role=body.get("role") if "role" in body else body.get("rol"),
    )

    if result["ok"]:
        await context.ws_queue.put(template_update_event(context.db))

    return web.json_response(result, status=200 if result["ok"] else 400)


async def api_character_delete(request):
    context = request.app["context"]
    character_id = parse_positive_int(request.match_info["character_id"])

    if character_id is None:
        return web.json_response({
            "ok": False,
            "mensaje": "Personaje inválido.",
        }, status=400)

    result = context.db.players.delete_character(character_id)

    if result["ok"]:
        await context.ws_queue.put(template_update_event(context.db))

    return web.json_response(result, status=200 if result["ok"] else 404)


async def api_character_sheet_update_by_id(request):
    context = request.app["context"]
    character_id = parse_positive_int(request.match_info["character_id"])

    if character_id is None:
        return web.json_response({
            "ok": False,
            "mensaje": "Personaje inválido.",
        }, status=400)

    character = context.db.players.get_character(character_id)
    if character is None:
        return web.json_response({
            "ok": False,
            "mensaje": "Personaje no encontrado.",
        }, status=404)

    try:
        body = await request.json()
    except Exception:
        return web.json_response({
            "ok": False,
            "mensaje": "JSON inválido.",
        }, status=400)

    fields = body.get("fields")
    if not isinstance(fields, dict):
        return web.json_response({
            "ok": False,
            "mensaje": "Faltan campos de ficha.",
        }, status=400)

    result = context.db.character_templates.update_character_values(character_id, fields)

    if result.get("ok"):
        await context.ws_queue.put(character_sheet_update_event(
            character["playerName"],
            result.get("sheet"),
            fields,
            character,
        ))

    return web.json_response(result, status=200 if result.get("ok") else 400)


async def api_character_sheet_update(request):
    context = request.app["context"]
    username = normalize_user_or_broadcast(context.db, request.match_info["username"])

    if username is None or username == "TODOS":
        return web.json_response({
            "ok": False,
            "mensaje": "Usuario no reconocido.",
        }, status=404)

    player = context.db.players.get(username)

    try:
        body = await request.json()
    except Exception:
        return web.json_response({
            "ok": False,
            "mensaje": "JSON inválido.",
        }, status=400)

    fields = body.get("fields")
    if not isinstance(fields, dict):
        return web.json_response({
            "ok": False,
            "mensaje": "Faltan campos de ficha.",
        }, status=400)

    result = context.db.character_templates.update_player_values(player["id"], fields)

    if result.get("ok"):
        await context.ws_queue.put(character_sheet_update_event(username, result.get("sheet"), fields))

    return web.json_response(result, status=200 if result.get("ok") else 400)


async def api_dice_roll_create(request):
    context = request.app["context"]

    try:
        body = await request.json()
    except Exception:
        return web.json_response({
            "ok": False,
            "mensaje": "JSON inválido.",
        }, status=400)

    username = str(body.get("username", "")).strip()
    character_name = str(body.get("characterName", "")).strip()
    field_label = str(body.get("fieldLabel", "")).strip() or "tirada"
    dice = str(body.get("dice", "")).strip() or "d20"
    formula = str(body.get("formula", "")).strip()
    breakdown = str(body.get("breakdown", "")).strip()
    natural = parse_int(body.get("natural"))
    modifier = parse_int(body.get("modifier"))
    total = parse_int(body.get("total"))

    if not username or natural is None or modifier is None or total is None:
        return web.json_response({
            "ok": False,
            "mensaje": "Faltan datos de tirada.",
        }, status=400)

    actor = f"{username}-{character_name}" if character_name and character_name != username else username
    modifier_label = f"+{modifier}" if modifier >= 0 else str(modifier)
    formula = formula or f"{dice}{modifier_label}"
    max_roll = parse_positive_int(str(dice).lower().removeprefix("d"))
    suffix = ""

    if max_roll is not None and natural == max_roll:
        suffix = ", CRITICO!"
    elif natural == 1:
        suffix = ", PIFIA!"

    mensaje = (
        f"{actor} ha lanzado una tirada de {field_label} "
        f"({formula}): {breakdown or f'{natural}{modifier_label}'}:{total}{suffix}"
    )
    action = {
        "tipo": "DICE_ROLL",
        "destinatario": "TODOS",
        "mensaje": mensaje,
        "valor": {
            "username": username,
            "characterName": character_name,
            "fieldLabel": field_label,
            "dice": dice,
            "formula": formula,
            "breakdown": breakdown,
            "natural": natural,
            "modifier": modifier,
            "total": total,
            "critical": max_roll is not None and natural == max_roll,
            "fumble": natural == 1,
        },
    }
    await context.ws_queue.put(action)

    return web.json_response({
        "ok": True,
        "mensaje": mensaje,
        "accion": action,
    })


def template_update_event(db):
    template = db.character_templates.active_template()
    characters = []

    for character in db.players.all_characters():
        if not character["active"]:
            continue

        characters.append({
            **character,
            "sheet": db.character_templates.sheet_for_character(character["id"]),
        })

    return {
        "tipo": "TEMPLATE_UPDATE",
        "destinatario": "TODOS",
        "mensaje": f"Plantilla activa actualizada: {template['label']}" if template else "Plantilla activa actualizada.",
        "valor": {
            "template": template,
            "characters": characters,
        },
    }


def character_sheet_update_event(username: str, sheet: dict | None, fields: dict, character: dict | None = None):
    return {
        "tipo": "CHARACTER_SHEET_UPDATE",
        "destinatario": username,
        "mensaje": f"Ficha actualizada: {character['name']}" if character else f"Ficha actualizada: {username}",
        "valor": {
            "username": username,
            "character": character,
            "characterId": character["id"] if character else None,
            "sheet": sheet,
            "fields": [key for key in fields.keys() if isinstance(key, str)],
        },
    }


async def api_templates(request):
    context = request.app["context"]

    return web.json_response({
        "ok": True,
        "templates": context.db.character_templates.all_templates(),
    })


async def api_templates_create(request):
    context = request.app["context"]

    try:
        body = await request.json()
    except Exception:
        return web.json_response({
            "ok": False,
            "mensaje": "JSON inválido.",
        }, status=400)

    result = context.db.character_templates.create_template(
        str(body.get("key", "")),
        str(body.get("label", "")),
        body.get("schema") if isinstance(body.get("schema"), dict) else None,
    )

    return web.json_response(result, status=200 if result["ok"] else 400)


async def api_templates_duplicate(request):
    context = request.app["context"]
    template_id = parse_positive_int(request.match_info["template_id"])

    if template_id is None:
        return web.json_response({
            "ok": False,
            "mensaje": "Plantilla inválida.",
        }, status=400)

    try:
        body = await request.json()
    except Exception:
        return web.json_response({
            "ok": False,
            "mensaje": "JSON inválido.",
        }, status=400)

    result = context.db.character_templates.duplicate_template(
        template_id,
        str(body.get("key", "")),
        str(body.get("label", "")),
        body.get("schema") if isinstance(body.get("schema"), dict) else None,
    )

    return web.json_response(result, status=200 if result["ok"] else 400)


async def api_templates_update(request):
    context = request.app["context"]
    template_id = parse_positive_int(request.match_info["template_id"])

    if template_id is None:
        return web.json_response({
            "ok": False,
            "mensaje": "Plantilla inválida.",
        }, status=400)

    try:
        body = await request.json()
    except Exception:
        return web.json_response({
            "ok": False,
            "mensaje": "JSON inválido.",
        }, status=400)

    fields = body.get("fields")
    if not isinstance(fields, list):
        fields = []

    result = context.db.character_templates.update_template(
        template_id,
        str(body.get("label", "")),
        fields,
        body.get("schema") if isinstance(body.get("schema"), dict) else None,
    )

    if result.get("ok") and result.get("template", {}).get("active"):
        await context.ws_queue.put(template_update_event(context.db))

    return web.json_response(result, status=200 if result["ok"] else 400)


async def api_templates_activate(request):
    context = request.app["context"]
    template_id = parse_positive_int(request.match_info["template_id"])

    if template_id is None:
        return web.json_response({
            "ok": False,
            "mensaje": "Plantilla inválida.",
        }, status=400)

    result = context.db.character_templates.set_active(template_id)

    if result.get("ok"):
        await context.ws_queue.put(template_update_event(context.db))

    return web.json_response(result, status=200 if result["ok"] else 400)


async def api_templates_delete(request):
    context = request.app["context"]
    template_id = parse_positive_int(request.match_info["template_id"])

    if template_id is None:
        return web.json_response({
            "ok": False,
            "mensaje": "Plantilla inválida.",
        }, status=400)

    result = context.db.character_templates.delete_template(template_id)

    return web.json_response(result, status=200 if result["ok"] else 400)


async def media_catalog_endpoint(request):
    context = request.app["context"]

    return web.json_response({
        "ok": True,
        "catalogo": context.media_catalog.list(),
    })


async def name_generator_options(request):
    return web.json_response({
        "ok": True,
        "count": 10,
        "personas": [
            {
                "value": key,
                "label": value["label"],
            }
            for key, value in HUMAN_NAME_SETS.items()
        ],
        "fantasia": [
            {
                "value": key,
                "label": label,
            }
            for key, label in FANTASY_RACE_LABELS
        ],
    })


async def generate_names_endpoint(request):
    try:
        body = await request.json()
    except Exception:
        return web.json_response({
            "ok": False,
            "mensaje": "JSON inválido.",
        }, status=400)

    category = str(body.get("category", "persona"))
    subtype = str(body.get("subtype", "es"))
    gender = str(body.get("gender", "any"))
    names = generate_names(category, subtype, gender)

    return web.json_response({
        "ok": True,
        "mensaje": "10 nombres generados.",
        "category": category,
        "subtype": subtype,
        "gender": gender,
        "count": len(names),
        "names": names,
    })


async def send_media(request):
    context = request.app["context"]

    try:
        body = await request.json()
    except Exception:
        return web.json_response({
            "ok": False,
            "mensaje": "JSON inválido.",
        }, status=400)

    destinatario = normalize_user_or_broadcast(context.db, str(body.get("destinatario", "")))
    nombre = str(body.get("nombre", "")).strip()

    if destinatario is None:
        return web.json_response({
            "ok": False,
            "mensaje": "Destinatario no reconocido.",
        }, status=404)

    archivo = context.media_catalog.find(nombre)

    if archivo is None:
        return web.json_response({
            "ok": False,
            "mensaje": "No he encontrado ese archivo.",
        }, status=404)

    action = {
        "tipo": "MUESTRA",
        "destinatario": destinatario,
        "valor": archivo,
    }
    await context.ws_queue.put(action)

    return web.json_response({
        "ok": True,
        "mensaje": f"Enviando {archivo['nombre']}.",
        "accion": action,
    })


async def upload_media(request):
    context = request.app["context"]
    reader = await request.multipart()
    upload_path = None
    display_name = ""
    aliases = []

    async for part in reader:
        if part.name == "file":
            suffix = Path(part.filename or "archivo").suffix
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                upload_path = Path(temp_file.name)
                while True:
                    chunk = await part.read_chunk()
                    if not chunk:
                        break
                    temp_file.write(chunk)
        elif part.name == "name":
            display_name = (await part.text()).strip()
        elif part.name == "aliases":
            aliases = parse_aliases(await part.text())

    if upload_path is None:
        return web.json_response({
            "ok": False,
            "mensaje": "Falta archivo.",
        }, status=400)

    try:
        result = context.media_catalog.add_file(upload_path, display_name, aliases)
    finally:
        upload_path.unlink(missing_ok=True)

    return web.json_response(result, status=200 if result["ok"] else 400)


async def delete_media(request):
    context = request.app["context"]
    result = context.media_catalog.delete_file(request.match_info["filename"])

    return web.json_response(result, status=200 if result["ok"] else 404)


async def start_countdown(request):
    context = request.app["context"]

    try:
        body = await request.json()
    except Exception:
        return web.json_response({
            "ok": False,
            "mensaje": "JSON inválido.",
        }, status=400)

    destinatario = normalize_user_or_broadcast(context.db, str(body.get("destinatario", "TODOS")))
    duration_seconds = parse_positive_int(body.get("durationSeconds"))
    label = str(body.get("label", "Temporizador")).strip() or "Temporizador"

    if destinatario is None:
        return web.json_response({
            "ok": False,
            "mensaje": "Destinatario no reconocido.",
        }, status=404)

    if duration_seconds is None:
        return web.json_response({
            "ok": False,
            "mensaje": "Duración inválida.",
        }, status=400)

    target_at = datetime.now(timezone.utc) + timedelta(seconds=duration_seconds)
    action = {
        "tipo": "COUNTDOWN",
        "destinatario": destinatario,
        "valor": {
            "durationSeconds": duration_seconds,
            "targetAt": target_at.isoformat(),
            "label": label,
        },
    }
    await context.ws_queue.put(action)

    return web.json_response({
        "ok": True,
        "mensaje": "Temporizador enviado.",
        "accion": action,
    })


async def cancel_countdown(request):
    context = request.app["context"]

    action = {
        "tipo": "COUNTDOWN_CANCEL",
        "destinatario": "TODOS",
        "valor": {
            "cancelledAt": datetime.now(timezone.utc).isoformat(),
        },
    }
    await context.ws_queue.put(action)

    return web.json_response({
        "ok": True,
        "mensaje": "Countdown cancelado.",
        "accion": action,
    })


async def music_status(request):
    context = request.app["context"]

    return web.json_response({
        "ok": True,
        "estado": context.music_service.status(),
        "catalogo": music_catalog(),
    })


async def play_music(request):
    context = request.app["context"]

    try:
        body = await request.json()
    except Exception:
        return web.json_response({
            "ok": False,
            "mensaje": "JSON inválido.",
        }, status=400)

    contexto = str(body.get("contexto", "")).strip().lower()
    numero = parse_positive_int(body.get("numero")) or 1
    canciones = MUSIC_MAP.get(contexto)

    if not canciones or numero not in canciones:
        return web.json_response({
            "ok": False,
            "mensaje": "Música no registrada.",
        }, status=404)

    result = context.music_service.play(
        canciones[numero],
        label=f"{contexto} {numero}",
        context=contexto,
        number=numero,
    )

    return web.json_response(result, status=200 if result["ok"] else 400)


async def control_music(request):
    context = request.app["context"]

    try:
        body = await request.json()
    except Exception:
        return web.json_response({
            "ok": False,
            "mensaje": "JSON inválido.",
        }, status=400)

    action = str(body.get("action", "")).strip().lower()

    if action == "up":
        result = context.music_service.volume_up()
    elif action == "down":
        result = context.music_service.volume_down()
    elif action == "pause":
        result = context.music_service.pause()
    elif action in ("play", "resume"):
        result = context.music_service.resume()
    elif action == "restart":
        result = context.music_service.restart()
    elif action == "stop":
        result = context.music_service.stop()
    else:
        result = {
            "ok": False,
            "mensaje": "Control de música no reconocido.",
        }

    return web.json_response(result, status=200 if result["ok"] else 400)


async def start_web_server(context):
    app = web.Application(client_max_size=128 * 1024 * 1024)
    app["context"] = context
    app.on_startup.append(start_ws_loop)
    app.on_cleanup.append(stop_ws_loop)

    app.router.add_get("/", index)
    app.router.add_get("/config", config_index)
    app.router.add_get("/logs", config_logs)
    app.router.add_post("/settings", config_settings)
    app.router.add_post("/theme", config_theme)
    app.router.add_post("/theme/preset", config_theme_preset)
    app.router.add_post("/apply-release", config_apply_release)
    app.router.add_post("/client/reset", config_client_reset)
    app.router.add_post("/start-eva", config_start_eva)
    app.router.add_post("/stop-eva", config_stop_eva)
    app.router.add_post("/players/add", config_players_add)
    app.router.add_post("/players/delete", config_players_delete)
    app.router.add_post("/media/upload", config_media_upload)
    app.router.add_post("/media/delete", config_media_delete)
    app.router.add_post("/jokes/add", config_jokes_add)
    app.router.add_post("/intro/upload", config_intro_upload)
    app.router.add_get("/ws", websocket_handler)
    app.router.add_get("/api/config", api_config)
    app.router.add_post("/api/client/reset", api_client_reset)
    app.router.add_get("/index.css", index_css)
    app.router.add_get("/scripts.js", scripts_js)
    app.router.add_get("/favicon.ico", favicon)
    app.router.add_get("/favicon.png", favicon)

    app.router.add_post("/api/login", login)
    app.router.add_get("/load/{username}", load_user_state)

    app.router.add_get("/api/users", api_users)
    app.router.add_post("/api/users", api_users_create)
    app.router.add_delete("/api/users/{username}", api_users_delete)
    app.router.add_get("/api/status", api_status)
    app.router.add_get("/api/characters", api_characters)
    app.router.add_post("/api/characters", api_characters_create)
    app.router.add_put("/api/characters/{character_id}", api_character_update)
    app.router.add_delete("/api/characters/{character_id}", api_character_delete)
    app.router.add_put("/api/characters/by-id/{character_id}/sheet", api_character_sheet_update_by_id)
    app.router.add_put("/api/characters/{username}/sheet", api_character_sheet_update)
    app.router.add_post("/api/dice-rolls", api_dice_roll_create)
    app.router.add_get("/api/templates", api_templates)
    app.router.add_post("/api/templates", api_templates_create)
    app.router.add_post("/api/templates/{template_id}/duplicate", api_templates_duplicate)
    app.router.add_put("/api/templates/{template_id}", api_templates_update)
    app.router.add_post("/api/templates/{template_id}/activate", api_templates_activate)
    app.router.add_delete("/api/templates/{template_id}", api_templates_delete)

    app.router.add_get("/api/media/catalog", media_catalog_endpoint)
    app.router.add_post("/api/media/send", send_media)
    app.router.add_post("/api/media/upload", upload_media)
    app.router.add_delete("/api/media/{filename}", delete_media)
    app.router.add_get("/api/name-generator/options", name_generator_options)
    app.router.add_post("/api/name-generator", generate_names_endpoint)

    app.router.add_post("/api/countdown", start_countdown)
    app.router.add_post("/api/countdown/cancel", cancel_countdown)

    app.router.add_get("/api/music/status", music_status)
    app.router.add_post("/api/music/play", play_music)
    app.router.add_post("/api/music/control", control_music)
    media_path = Path(os.environ.get("EVA_MEDIA_ROOT") or "media").resolve()
    media_path.mkdir(parents=True, exist_ok=True)
    app.router.add_static("/media/", path=media_path, name="media")
    app.router.add_static("/assets/", path=WEB_ASSETS_PATH, name="assets")
    app.router.add_static("/styles/", path=WEB_STYLES_PATH, name="styles")

    runner = web.AppRunner(app)
    await runner.setup()

    site = web.TCPSite(runner, context.web_host, context.web_port)
    await site.start()

    print(f"[WEB] Panel en http://localhost:{context.web_port}")
    print(f"[WEB] Media en http://localhost:{context.web_port}/media/")

    await asyncio.Event().wait()


def parse_aliases(value):
    if isinstance(value, list):
        raw_aliases = value
    else:
        raw_aliases = str(value or "").split(",")

    return [
        str(alias).strip()
        for alias in raw_aliases
        if str(alias).strip()
    ]
