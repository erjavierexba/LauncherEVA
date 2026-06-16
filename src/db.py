import sqlite3
import shutil
import os
from datetime import datetime
from pathlib import Path

from .db_domains.character_templates import CharacterTemplatesRepository
from .db_domains.players import PlayersRepository

DB_PATH = Path(os.environ.get("EVA_DB_PATH") or "eva.sqlite3")


class DB:
    def __init__(self, db_path=DB_PATH, initial_users=None, max_backups=None):
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.max_backups = self._resolve_max_backups(max_backups)
        self._backup_existing_db(db_path)
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row

        self.character_templates = CharacterTemplatesRepository(self.conn)
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
        self._prune_backups(path)

    def _resolve_max_backups(self, max_backups):
        if max_backups is None:
            max_backups = os.environ.get("EVA_DB_MAX_BACKUPS", 10)

        try:
            parsed = int(max_backups)
        except (TypeError, ValueError):
            return 10

        return max(0, parsed)

    def _prune_backups(self, db_path: Path):
        if self.max_backups <= 0:
            backups_to_delete = list(db_path.parent.glob(f"{db_path.name}.backup-*"))
        else:
            backups = sorted(
                db_path.parent.glob(f"{db_path.name}.backup-*"),
                key=lambda backup: backup.stat().st_mtime,
                reverse=True,
            )
            backups_to_delete = backups[self.max_backups:]

        for backup in backups_to_delete:
            if backup.is_file():
                backup.unlink()
