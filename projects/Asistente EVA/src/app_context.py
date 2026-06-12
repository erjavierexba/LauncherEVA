import asyncio
from dataclasses import dataclass
from typing import TYPE_CHECKING

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
    web_port: int = 8080
    ws_host: str = "0.0.0.0"
    ws_port: int = 8765


_context: AppContext | None = None


def create_app_context() -> AppContext:
    from src.db import DB
    from src.services.app_config import AppConfig
    from src.services.media_catalog import MediaCatalog
    from src.services.music_service import MusicService
    from src.services.network import get_base_url

    web_port = 8080
    config = AppConfig()

    return AppContext(
        db=DB(initial_users=config.users()),
        ws_queue=asyncio.Queue(),
        incoming_queue=asyncio.Queue(),
        config=config,
        music_service=MusicService(),
        media_catalog=MediaCatalog(base_url=get_base_url(web_port)),
        web_port=web_port,
    )


def set_app_context(context: AppContext):
    global _context
    _context = context


def get_app_context() -> AppContext:
    if _context is None:
        raise RuntimeError("AppContext no inicializado.")

    return _context
