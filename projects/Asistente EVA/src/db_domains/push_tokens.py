from datetime import datetime, timezone


class PushTokensRepository:
    def __init__(self, conn):
        self.conn = conn
        self.init_table()

    def init_table(self):
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS push_tokens (
                username TEXT NOT NULL,
                token TEXT NOT NULL UNIQUE,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (username, token)
            )
        """)
        self.conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_push_tokens_username
            ON push_tokens (username)
        """)
        self.conn.commit()

    def save(self, username: str, token: str):
        updated_at = datetime.now(timezone.utc).isoformat()
        self.conn.execute(
            """
            INSERT INTO push_tokens (username, token, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(token) DO UPDATE SET
                username = excluded.username,
                updated_at = excluded.updated_at
            """,
            (username, token, updated_at),
        )
        self.conn.commit()

    def get_by_username(self, username: str):
        rows = self.conn.execute(
            """
            SELECT token
            FROM push_tokens
            WHERE username = ?
            ORDER BY updated_at DESC
            """,
            (username,),
        ).fetchall()

        return [row["token"] for row in rows]

    def delete_by_username(self, username: str):
        self.conn.execute(
            "DELETE FROM push_tokens WHERE username = ?",
            (username,),
        )
        self.conn.commit()
