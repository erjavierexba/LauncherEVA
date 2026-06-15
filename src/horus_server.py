import asyncio
import json
import os
from pathlib import Path

from aiohttp import web

from src.web_server import (
    FAVICON_PATH,
    WEB_ASSETS_PATH,
    api_character_sheet_update,
    api_character_sheet_update_by_id,
    api_character_delete,
    api_character_update,
    api_characters_create,
    api_config,
    api_dice_roll_create,
    load_user_state,
    login,
    no_store_headers,
)


BASE_DIR = Path(__file__).parent
HORUS_ROOT = BASE_DIR / "horus"
HORUS_INDEX_PATH = HORUS_ROOT / "index.html"
HORUS_CSS_PATH = HORUS_ROOT / "horus.css"
HORUS_JS_PATH = HORUS_ROOT / "horus.js"


def render_horus_html(context, ws_url: str) -> str:
    theme = context.config.data["theme"]
    assistant = context.config.data["assistant"]
    project = context.config.data.get("project", {})
    client_title = str(project.get("roleName") or theme.get("title") or assistant.get("name") or "EVA")
    client_subtitle = str(project.get("appSubtitle") or assistant.get("name") or "EVA")

    return (
        HORUS_INDEX_PATH.read_text(encoding="utf-8")
        .replace("{{WS_URL}}", ws_url)
        .replace("{{SESSION_ID}}", str(context.session_id))
        .replace("{{HORUS_PORT}}", str(context.horus_port))
        .replace("{{APP_TITLE}}", str(theme.get("title") or assistant.get("name") or "Cliente EVA"))
        .replace("{{CLIENT_TITLE}}", client_title)
        .replace("{{CLIENT_SUBTITLE}}", client_subtitle)
        .replace("{{THEME_JSON}}", json.dumps(theme, ensure_ascii=False))
    )


async def horus_index(request):
    context = request.app["context"]
    ws_url = f"ws://{request.host.split(':')[0]}:{context.ws_port}/ws"

    return web.Response(
        text=render_horus_html(context, ws_url),
        content_type="text/html",
        headers=no_store_headers(),
    )


async def horus_css(request):
    return web.FileResponse(HORUS_CSS_PATH, headers=no_store_headers())


async def horus_js(request):
    return web.FileResponse(HORUS_JS_PATH, headers=no_store_headers())


async def favicon(request):
    return web.FileResponse(FAVICON_PATH)


async def start_horus_server(context):
    app = web.Application(client_max_size=128 * 1024 * 1024)
    app["context"] = context

    app.router.add_get("/", horus_index)
    app.router.add_get("/horus.css", horus_css)
    app.router.add_get("/horus.js", horus_js)
    app.router.add_get("/favicon.ico", favicon)
    app.router.add_get("/favicon.png", favicon)

    app.router.add_get("/api/config", api_config)
    app.router.add_post("/api/login", login)
    app.router.add_get("/load/{username}", load_user_state)
    app.router.add_post("/api/characters", api_characters_create)
    app.router.add_put("/api/characters/{character_id}", api_character_update)
    app.router.add_delete("/api/characters/{character_id}", api_character_delete)
    app.router.add_put("/api/characters/by-id/{character_id}/sheet", api_character_sheet_update_by_id)
    app.router.add_put("/api/characters/{username}/sheet", api_character_sheet_update)
    app.router.add_post("/api/dice-rolls", api_dice_roll_create)
    media_path = Path(os.environ.get("EVA_MEDIA_ROOT") or "media").resolve()
    media_path.mkdir(parents=True, exist_ok=True)
    app.router.add_static("/media/", path=media_path, name="media")
    app.router.add_static("/assets/", path=WEB_ASSETS_PATH, name="assets")

    runner = web.AppRunner(app)
    await runner.setup()

    site = web.TCPSite(runner, context.web_host, context.horus_port)
    await site.start()

    print(f"[CLIENTE] Web de jugadores en http://localhost:{context.horus_port}")

    await asyncio.Event().wait()
