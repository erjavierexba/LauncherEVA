import sqlite3
import shutil
import os
from datetime import datetime
from pathlib import Path

from .db_domains.cards import CardsRepository
from .db_domains.character_templates import CharacterTemplatesRepository
from .db_domains.players import PlayersRepository

DB_PATH = Path(os.environ.get("EVA_DB_PATH") or "eva.sqlite3")


class DB:
    def __init__(self, db_path=DB_PATH, initial_users=None):
        self._backup_existing_db(db_path)
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row

        self.character_templates = CharacterTemplatesRepository(self.conn)
        self.cards = CardsRepository(self.conn)
        self.players = PlayersRepository(
            self.conn,
            initial_users=initial_users,
            character_templates=self.character_templates,
        )

    def _backup_existing_db(self, db_path):
        path = Path(db_path)

        if not path.exists() or not path.is_file():
            return

        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        backup_path = path.with_name(f"{path.name}.backup-{timestamp}")
        shutil.copy2(path, backup_path)
