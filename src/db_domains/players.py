import json

from src.domain.players import normalizar


class PlayersRepository:
    def __init__(self, conn, initial_users=None, character_templates=None):
        if character_templates is None and hasattr(initial_users, "active_template"):
            character_templates = initial_users
            initial_users = None

        self.conn = conn
        self.initial_users = initial_users or []
        self.character_templates = character_templates
        self.init_table()

    def init_table(self):
        self._migrate_legacy_table()
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL UNIQUE,
                aliases TEXT NOT NULL DEFAULT '[]',
                npc INTEGER NOT NULL DEFAULT 0,
                active INTEGER NOT NULL DEFAULT 1,
                eliminated_at TEXT NULL
            )
        """)
        self._ensure_columns()
        self._init_characters_table()

        for user in self.initial_users:
            nombre = user["name"] if isinstance(user, dict) else str(user)
            aliases = user.get("aliases", []) if isinstance(user, dict) else []
            self.conn.execute(
                """
                INSERT OR IGNORE INTO players (nombre, aliases, npc, active)
                VALUES (?, ?, 0, 1)
                """,
                (nombre, json.dumps(aliases, ensure_ascii=False)),
            )
            self._merge_config_aliases(nombre, aliases)

        if self.character_templates is not None:
            self.character_templates.ensure_values_for_all_players()
            self._ensure_legacy_characters()

        self.conn.commit()

    def _merge_config_aliases(self, nombre: str, aliases: list[str]):
        row = self.conn.execute(
            "SELECT aliases FROM players WHERE nombre = ?",
            (nombre,),
        ).fetchone()

        if row is None:
            return

        merged = []
        seen = set()
        for alias in [*parse_aliases(row["aliases"]), *aliases]:
            clean = str(alias).strip()
            key = normalizar(clean)
            if clean and key not in seen:
                seen.add(key)
                merged.append(clean)

        self.conn.execute(
            "UPDATE players SET aliases = ? WHERE nombre = ?",
            (json.dumps(merged, ensure_ascii=False), nombre),
        )

    def _init_characters_table(self):
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS player_characters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_id INTEGER NOT NULL,
                template_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT '',
                notes TEXT NOT NULL DEFAULT '',
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(player_id, template_id, name),
                FOREIGN KEY(player_id) REFERENCES players(id),
                FOREIGN KEY(template_id) REFERENCES character_templates(id)
            )
        """)
        self._ensure_character_columns()

    def _ensure_character_columns(self):
        columns = {
            row["name"]
            for row in self.conn.execute("PRAGMA table_info(player_characters)").fetchall()
        }
        if "notes" not in columns:
            self.conn.execute("ALTER TABLE player_characters ADD COLUMN notes TEXT NOT NULL DEFAULT ''")

    def _ensure_legacy_characters(self):
        if self.character_templates is None:
            return

        template = self.character_templates.active_template()
        if template is None:
            return

        existing = self.conn.execute("SELECT COUNT(*) AS total FROM player_characters").fetchone()
        if existing and existing["total"] > 0:
            return

        rows = self.conn.execute(
            """
            SELECT id, nombre, npc, active
            FROM players
            ORDER BY id ASC
            """
        ).fetchall()

        for row in rows:
            cursor = self.conn.execute(
                """
                INSERT OR IGNORE INTO player_characters (player_id, template_id, name, role, active)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    row["id"],
                    template["id"],
                    row["nombre"],
                    "NPC" if row["npc"] else "Jugador",
                    row["active"],
                ),
            )
            character_id = cursor.lastrowid
            if character_id:
                self.character_templates.copy_player_values_to_character(
                    row["id"],
                    character_id,
                    template["id"],
                )

    def _ensure_columns(self):
        columns = {
            row["name"]
            for row in self.conn.execute("PRAGMA table_info(players)").fetchall()
        }

        if "npc" not in columns:
            self.conn.execute("ALTER TABLE players ADD COLUMN npc INTEGER NOT NULL DEFAULT 0")

        if "aliases" not in columns:
            self.conn.execute("ALTER TABLE players ADD COLUMN aliases TEXT NOT NULL DEFAULT '[]'")

        if "active" not in columns:
            self.conn.execute("ALTER TABLE players ADD COLUMN active INTEGER NOT NULL DEFAULT 1")

        if "eliminated_at" not in columns:
            self.conn.execute("ALTER TABLE players ADD COLUMN eliminated_at TEXT NULL")

    def _migrate_legacy_table(self):
        table = self.conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'players'"
        ).fetchone()

        if table is None:
            return

        columns = {
            row["name"]
            for row in self.conn.execute("PRAGMA table_info(players)").fetchall()
        }

        if {"id", "nombre", "npc"}.issubset(columns):
            return

        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS players_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL UNIQUE,
                aliases TEXT NOT NULL DEFAULT '[]',
                npc INTEGER NOT NULL DEFAULT 0,
                active INTEGER NOT NULL DEFAULT 1,
                eliminated_at TEXT NULL
            )
        """)

        aliases_expr = "COALESCE(aliases, '[]')" if "aliases" in columns else "'[]'"

        if "username" in columns:
            self.conn.execute("""
                INSERT OR IGNORE INTO players_new (nombre, aliases, npc, active, eliminated_at)
                SELECT username, '[]', 0, active, eliminated_at
                FROM players
            """)
        elif {"nombre", "npc"}.issubset(columns):
            self.conn.execute("""
                INSERT OR IGNORE INTO players_new (nombre, aliases, npc, active, eliminated_at)
                SELECT nombre,
                       {aliases_expr},
                       COALESCE(npc, 0),
                       COALESCE(active, 1),
                       eliminated_at
                FROM players
            """.format(aliases_expr=aliases_expr))
        elif "nombre" in columns:
            self.conn.execute("""
                INSERT OR IGNORE INTO players_new (nombre, aliases, npc, active, eliminated_at)
                SELECT nombre,
                       '[]',
                       0,
                       COALESCE(active, 1),
                       eliminated_at
                FROM players
            """)

        self.conn.execute("DROP TABLE players")
        self.conn.execute("ALTER TABLE players_new RENAME TO players")
        self.conn.commit()

    def all(self):
        rows = self.conn.execute(
            """
            SELECT id, nombre, aliases, npc, active, eliminated_at
            FROM players
            ORDER BY npc ASC, nombre COLLATE NOCASE ASC
            """
        ).fetchall()

        return [
            {
                "id": row["id"],
                "nombre": row["nombre"],
                "username": row["nombre"],
                "aliases": parse_aliases(row["aliases"]),
                "npc": bool(row["npc"]),
                "active": bool(row["active"]),
                "eliminatedAt": row["eliminated_at"],
            }
            for row in rows
        ]

    def get(self, nombre: str):
        normalized = normalizar(nombre or "")

        if not normalized:
            return None

        for player in self.all():
            if normalizar(player["nombre"]) == normalized:
                return player

        return None

    def create_npc(self, nombre: str, fields: dict | None = None):
        return self.create_user(nombre, fields=fields)

    def create_user(self, nombre: str, aliases=None, fields: dict | None = None):
        clean = (nombre or "").strip()
        aliases = aliases or []

        if not clean:
            return {
                "ok": False,
                "mensaje": "Falta el nombre del personaje.",
            }

        if self.get(clean) is not None:
            return {
                "ok": False,
                "mensaje": f"{clean} ya existe.",
            }

        cursor = self.conn.execute(
            "INSERT INTO players (nombre, aliases, npc, active) VALUES (?, ?, 0, 1)",
            (clean, json.dumps(aliases, ensure_ascii=False)),
        )
        if self.character_templates is not None:
            self.character_templates.ensure_values_for_player(cursor.lastrowid, fields)
            self._create_default_character_for_player(cursor.lastrowid, clean, "Jugador", fields)
        self.conn.commit()

        return {
            "ok": True,
            "mensaje": f"Usuario {clean} creado.",
            "personaje": {
                "id": cursor.lastrowid,
                "nombre": clean,
                "username": clean,
                "aliases": aliases,
                "npc": False,
                "active": True,
                "eliminatedAt": None,
            },
        }

    def _create_default_character_for_player(self, player_id: int, name: str, role: str, fields: dict | None = None):
        template = self.character_templates.active_template() if self.character_templates is not None else None
        if template is None:
            return None

        cursor = self.conn.execute(
            """
            INSERT OR IGNORE INTO player_characters (player_id, template_id, name, role, active)
            VALUES (?, ?, ?, ?, 1)
            """,
            (player_id, template["id"], name, role),
        )
        character_id = cursor.lastrowid
        if not character_id:
            row = self.conn.execute(
                """
                SELECT id
                FROM player_characters
                WHERE player_id = ? AND template_id = ? AND name = ?
                """,
                (player_id, template["id"], name),
            ).fetchone()
            character_id = row["id"] if row else None

        if character_id and self.character_templates is not None:
            self.character_templates.ensure_values_for_character(character_id, template["id"], fields)

        return character_id

    def delete_user(self, nombre: str):
        player = self.get(nombre)

        if player is None:
            return False

        cursor = self.conn.execute(
            "DELETE FROM players WHERE nombre = ?",
            (player["nombre"],),
        )
        self.conn.commit()

        return cursor.rowcount > 0

    def all_characters(self):
        rows = self.conn.execute(
            """
            SELECT c.id, c.player_id, c.template_id, c.name, c.role, c.notes, c.active, c.created_at,
                   p.nombre AS player_name, p.aliases, p.npc, p.active AS player_active,
                   p.eliminated_at,
                   t.key AS template_key, t.label AS template_label
            FROM player_characters c
            JOIN players p ON p.id = c.player_id
            JOIN character_templates t ON t.id = c.template_id
            ORDER BY p.nombre COLLATE NOCASE ASC, c.name COLLATE NOCASE ASC
            """
        ).fetchall()

        return [self._character_from_row(row) for row in rows]

    def characters_for_player(self, player_id: int):
        return [
            character
            for character in self.all_characters()
            if character["playerId"] == player_id
        ]

    def get_character(self, character_id: int):
        row = self.conn.execute(
            """
            SELECT c.id, c.player_id, c.template_id, c.name, c.role, c.notes, c.active, c.created_at,
                   p.nombre AS player_name, p.aliases, p.npc, p.active AS player_active,
                   p.eliminated_at,
                   t.key AS template_key, t.label AS template_label
            FROM player_characters c
            JOIN players p ON p.id = c.player_id
            JOIN character_templates t ON t.id = c.template_id
            WHERE c.id = ?
            """,
            (character_id,),
        ).fetchone()

        return self._character_from_row(row) if row else None

    def create_character(self, player_id: int, name: str, role: str = "", fields: dict | None = None, notes: str = "", template_id: int | None = None):
        clean_name = (name or "").strip()
        clean_role = (role or "").strip()
        clean_notes = (notes or "").strip()

        if not clean_name:
            return {
                "ok": False,
                "mensaje": "Falta el nombre del personaje.",
            }

        player = self.conn.execute(
            "SELECT id FROM players WHERE id = ?",
            (player_id,),
        ).fetchone()
        if player is None:
            return {
                "ok": False,
                "mensaje": "Jugador no encontrado.",
            }

        template = self.character_templates.get_template(template_id) if self.character_templates is not None and template_id else (
            self.character_templates.active_template() if self.character_templates is not None else None
        )
        if template is None:
            return {
                "ok": False,
                "mensaje": "No hay plantilla/manual disponible.",
            }

        try:
            cursor = self.conn.execute(
                """
                INSERT INTO player_characters (player_id, template_id, name, role, notes, active)
                VALUES (?, ?, ?, ?, ?, 1)
                """,
                (player_id, template["id"], clean_name, clean_role, clean_notes),
            )
        except Exception:
            return {
                "ok": False,
                "mensaje": "No se pudo crear el personaje. Revisa si ya existe para ese jugador y plantilla.",
            }

        if self.character_templates is not None:
            self.character_templates.ensure_values_for_character(cursor.lastrowid, template["id"], fields)

        self.conn.commit()

        return {
            "ok": True,
            "mensaje": f"Personaje {clean_name} creado.",
            "personaje": self.get_character(cursor.lastrowid),
        }

    def update_character(self, character_id: int, name: str | None = None, notes: str | None = None, role: str | None = None):
        character = self.get_character(character_id)

        if character is None:
            return {
                "ok": False,
                "mensaje": "Personaje no encontrado.",
            }

        clean_name = (name if name is not None else character["name"] or "").strip()
        clean_notes = (notes if notes is not None else character.get("notes", "") or "").strip()
        clean_role = (role if role is not None else character.get("role", "") or "").strip()

        if not clean_name:
            return {
                "ok": False,
                "mensaje": "Falta el nombre del personaje.",
            }

        try:
            self.conn.execute(
                """
                UPDATE player_characters
                SET name = ?, role = ?, notes = ?
                WHERE id = ?
                """,
                (clean_name, clean_role, clean_notes, character_id),
            )
            self.conn.commit()
        except Exception:
            return {
                "ok": False,
                "mensaje": "No se pudo actualizar el personaje. Revisa si ya existe ese nombre.",
            }

        return {
            "ok": True,
            "mensaje": f"Personaje {clean_name} actualizado.",
            "personaje": self.get_character(character_id),
        }

    def delete_character(self, character_id: int):
        character = self.get_character(character_id)

        if character is None:
            return {
                "ok": False,
                "mensaje": "Personaje no encontrado.",
            }

        self.conn.execute(
            "DELETE FROM character_template_values WHERE character_id = ?",
            (character_id,),
        )
        self.conn.execute(
            "DELETE FROM player_characters WHERE id = ?",
            (character_id,),
        )
        self.conn.commit()

        return {
            "ok": True,
            "mensaje": f"Personaje {character['name']} eliminado.",
        }

    def _character_from_row(self, row):
        active = bool(row["active"]) and bool(row["player_active"])

        return {
            "id": row["id"],
            "name": row["name"],
            "nombre": row["name"],
            "role": row["role"],
            "rol": row["role"],
            "notes": row["notes"],
            "notas": row["notes"],
            "active": active,
            "createdAt": row["created_at"],
            "playerId": row["player_id"],
            "playerName": row["player_name"],
            "username": row["player_name"],
            "aliases": parse_aliases(row["aliases"]),
            "npc": bool(row["npc"]),
            "playerActive": bool(row["player_active"]),
            "eliminatedAt": row["eliminated_at"],
            "template": {
                "id": row["template_id"],
                "key": row["template_key"],
                "label": row["template_label"],
            },
        }

    def is_active(self, username: str):
        row = self.conn.execute(
            "SELECT active FROM players WHERE nombre = ?",
            (username,),
        ).fetchone()

        return bool(row and row["active"])

    def is_npc(self, username: str):
        row = self.conn.execute(
            "SELECT npc FROM players WHERE nombre = ?",
            (username,),
        ).fetchone()

        return bool(row and row["npc"])

    def eliminate(self, username: str):
        if not username:
            return False

        cursor = self.conn.execute(
            """
            UPDATE players
            SET active = 0,
                eliminated_at = CURRENT_TIMESTAMP
            WHERE nombre = ? AND active = 1
            """,
            (username,),
        )
        self.conn.commit()

        return cursor.rowcount > 0


def parse_aliases(raw):
    try:
        aliases = json.loads(raw or "[]")
    except json.JSONDecodeError:
        return []

    if not isinstance(aliases, list):
        return []

    return [str(alias) for alias in aliases if str(alias).strip()]
