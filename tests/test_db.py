import tempfile
import unittest
from pathlib import Path

from src.db import DB


class DBTest(unittest.TestCase):
    def test_prunes_sqlite_backups_to_configured_limit(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "eva.sqlite3"

            for _index in range(4):
                db = DB(db_path=db_path, max_backups=2)
                db.conn.close()

            backups = list(db_path.parent.glob("eva.sqlite3.backup-*"))

        self.assertEqual(len(backups), 2)


if __name__ == "__main__":
    unittest.main()
