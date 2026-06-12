import json
from datetime import datetime, timezone


class NotificationsRepository:
    def __init__(self, conn):
        self.conn = conn
        self.init_table()

    def init_table(self):
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                payload TEXT NOT NULL,
                read_at TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        self.conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_notifications_pending
            ON notifications (username, read_at, created_at, id)
        """)
        self.conn.commit()

    def create(self, username: str, payload: dict):
        clean_username = username.strip()

        if not clean_username:
            return None

        cursor = self.conn.execute(
            """
            INSERT INTO notifications (username, payload)
            VALUES (?, ?)
            """,
            (clean_username, json.dumps(payload, ensure_ascii=False)),
        )
        self.conn.commit()

        return cursor.lastrowid

    def get_oldest_unread(self, username: str):
        row = self.conn.execute(
            """
            SELECT id, username, payload, created_at
            FROM notifications
            WHERE username = ? AND read_at IS NULL
            ORDER BY created_at ASC, id ASC
            LIMIT 1
            """,
            (username,),
        ).fetchone()

        if row is None:
            return None

        return {
            "id": row["id"],
            "username": row["username"],
            "createdAt": row["created_at"],
            "data": json.loads(row["payload"]),
        }

    def mark_read(self, username: str, notification_id: int):
        read_at = datetime.now(timezone.utc).isoformat()
        cursor = self.conn.execute(
            """
            UPDATE notifications
            SET read_at = ?
            WHERE id = ? AND username = ? AND read_at IS NULL
            """,
            (read_at, notification_id, username),
        )
        self.conn.commit()

        return cursor.rowcount > 0

    def mark_unread_type_read(self, notification_type: str):
        read_at = datetime.now(timezone.utc).isoformat()
        cursor = self.conn.execute(
            """
            UPDATE notifications
            SET read_at = ?
            WHERE read_at IS NULL
              AND json_extract(payload, '$.tipo') = ?
            """,
            (read_at, notification_type),
        )
        self.conn.commit()

        return cursor.rowcount
