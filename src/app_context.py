import asyncio
from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import uuid4

if TYPE_CHECKING:
    from src.db import DB
    from src.services.app_config import AppConfig
    from src.services.media_catalog import MediaCatalog
    from src.services.music_service import MusicService


@dataclass
class AppContext:
    db: "DB"
    ws_queue: asyncio.Queue
    incoming_queue: asyncio.Queue
    config: "AppConfig"
    music_service: "MusicService"
    media_catalog: "MediaCatalog"
    web_host: str = "0.0.0.0"
    web_port: int = 8000
    horus_port: int = 8080
    ws_host: str = "0.0.0.0"
    ws_port: int = 8000
    session_id: str = ""


_context: AppContext | None = None


def create_app_context() -> AppContext:
    from src.db import DB
    from src.services.app_config import AppConfig
    from src.services.media_catalog import MediaCatalog
    from src.services.music_service import MusicService
    from src.services.network import get_base_url

    config = AppConfig()
    server = config.data["server"]
    client_port = server["clientPort"]

    media_root = config.role_media_root()
    media_root.mkdir(parents=True, exist_ok=True)

    return AppContext(
        db=DB(db_path=config.role_db_path(), initial_users=config.users(), max_backups=config.max_db_backups()),
        ws_queue=asyncio.Queue(),
        incoming_queue=asyncio.Queue(),
        config=config,
        music_service=MusicService(),
        media_catalog=MediaCatalog(media_root=media_root, base_url=get_base_url(client_port)),
        web_host=server["host"],
        web_port=server["evaPort"],
        horus_port=client_port,
        ws_host=server["host"],
        ws_port=server["evaPort"],
        session_id=uuid4().hex,
    )


def set_app_context(context: AppContext):
    global _context
    _context = context


def get_app_context() -> AppContext:
    if _context is None:
        raise RuntimeError("AppContext no inicializado.")

    return _context


async def close_app_context(context: AppContext | None = None):
    global _context

    target = context or _context
    if target is None:
        return

    try:
        target.music_service.close()
    except Exception:
        pass

    try:
        target.db.close(backup=True)
    except Exception:
        pass

    if target is _context:
        _context = None
