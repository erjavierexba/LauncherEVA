import sqlite3
import os
from pathlib import Path

from .db_domains.character_templates import CharacterTemplatesRepository
from .db_domains.notifications import NotificationsRepository
from .db_domains.players import PlayersRepository
from .db_domains.push_tokens import PushTokensRepository

DB_PATH = Path(os.environ.get("EVA_DB_PATH", "eva.sqlite3"))


class DB:
    def __init__(self, db_path=DB_PATH, initial_users=None):
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row

        self.character_templates = CharacterTemplatesRepository(self.conn)
        self.players = PlayersRepository(
            self.conn,
            initial_users=initial_users,
            character_templates=self.character_templates,
        )
        self.notifications = NotificationsRepository(self.conn)
        self.push_tokens = PushTokensRepository(self.conn)
