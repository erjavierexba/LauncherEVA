import json
import re


class CharacterTemplatesRepository:
    FIELD_TYPES = {"text", "long_text", "csv", "int", "b_int", "throw", "formula", "array", "cycle"}
    BASIC_CHARACTER_SCHEMA = {
        "id": "personaje_basico",
        "name": "Personaje básico",
        "version": 1,
        "fields": [],
        "pages": [],
    }
    PATHFINDER_2E_SCHEMA = {
        "id": "pathfinder2e",
        "name": "Pathfinder 2e",
        "version": 1,
        "constants": {
            "proficiency": {
                "untrained": 0,
                "trained": 2,
                "expert": 4,
                "master": 6,
                "legendary": 8,
            },
            "attributeModifiers": {
                "8": -1,
                "10": 0,
                "12": 1,
                "14": 2,
                "16": 3,
                "18": 4,
            },
        },
        "fields": [
            {"key": "ancestry", "label": "Ancestría", "type": "text", "default": "", "editable": True},
            {"key": "background", "label": "Trasfondo", "type": "text", "default": "", "editable": True},
            {"key": "class", "label": "Clase", "type": "text", "default": "", "editable": True, "favorite": True},
            {"key": "level", "label": "Nivel", "type": "number", "default": 1, "editable": True, "display": "stepper", "favorite": True},
            {"key": "strength_modifier", "label": "Fue Mod", "type": "number", "default": 0, "editable": True},
            {"key": "dexterity_modifier", "label": "Des Mod", "type": "number", "default": 0, "editable": True},
            {"key": "constitution_modifier", "label": "Con Mod", "type": "number", "default": 0, "editable": True},
            {"key": "intelligence_modifier", "label": "Int Mod", "type": "number", "default": 0, "editable": True},
            {"key": "wisdom_modifier", "label": "Sab Mod", "type": "number", "default": 0, "editable": True},
            {"key": "charisma_modifier", "label": "Car Mod", "type": "number", "default": 0, "editable": True},
            {"key": "current_hp", "label": "PG", "type": "number", "default": 0, "editable": True, "display": "counter", "favorite": True},
            {"key": "temp_hp", "label": "PG temporales", "type": "number", "default": 0, "editable": True, "display": "counter", "favorite": True},
            {"key": "max_hp", "label": "PG máximos", "type": "number", "default": 0, "editable": True},
            {"key": "armor_class", "label": "CA", "type": "number", "default": 10, "editable": True, "favorite": True},
            {"key": "speed", "label": "Velocidad", "type": "text", "default": "25 pies", "editable": True},
            {"key": "perception_proficiency", "label": "Competencia Percepción", "type": "cycle", "default": "trained", "options": "proficiency"},
            {"key": "perception", "label": "Percepción", "type": "number", "formula": "*wisdom_modifier + *level + $proficiency[*perception_proficiency]"},
            {"key": "fortitude_proficiency", "label": "Competencia Fortaleza", "type": "cycle", "default": "trained", "options": "proficiency"},
            {"key": "reflex_proficiency", "label": "Competencia Reflejos", "type": "cycle", "default": "trained", "options": "proficiency"},
            {"key": "will_proficiency", "label": "Competencia Voluntad", "type": "cycle", "default": "trained", "options": "proficiency"},
            {"key": "fortitude", "label": "Fortaleza", "type": "number", "formula": "*constitution_modifier + *level + $proficiency[*fortitude_proficiency]"},
            {"key": "reflex", "label": "Reflejos", "type": "number", "formula": "*dexterity_modifier + *level + $proficiency[*reflex_proficiency]"},
            {"key": "will", "label": "Voluntad", "type": "number", "formula": "*wisdom_modifier + *level + $proficiency[*will_proficiency]"},
            {
                "key": "weapons",
                "label": "Armas",
                "type": "array",
                "display": "list",
                "itemTemplate": {
                    "fields": [
                        {"key": "name", "label": "Nombre", "type": "text", "default": ""},
                        {"key": "traits", "label": "Traits", "type": "csv", "default": ""},
                        {"key": "description", "label": "Descripción", "type": "long_text", "default": ""},
                        {"key": "attack", "label": "Acierto", "type": "formula", "formula": "1d20 + attack_bonus", "default": ""},
                        {"key": "damage", "label": "Daño", "type": "formula", "formula": "1d8", "default": ""},
                    ],
                },
            },
        ],
        "pages": [
            {
                "key": "overview",
                "label": "Resumen",
                "sections": [
                    {"key": "identity", "label": "Identidad", "fields": ["ancestry", "background", "class", "level"]},
                    {"key": "attributes", "label": "Atributos", "fields": [
                        "strength_modifier", "dexterity_modifier", "constitution_modifier",
                        "intelligence_modifier", "wisdom_modifier", "charisma_modifier",
                    ]},
                    {"key": "resources", "label": "Recursos", "fields": ["current_hp", "temp_hp", "max_hp", "armor_class", "speed"]},
                ],
            },
            {
                "key": "checks",
                "label": "Pruebas",
                "sections": [
                    {"key": "perception", "label": "Percepción", "fields": ["perception_proficiency", "perception"]},
                    {"key": "saves", "label": "Salvaciones", "fields": [
                        "fortitude_proficiency", "fortitude", "reflex_proficiency", "reflex", "will_proficiency", "will",
                    ]},
                ],
            },
            {
                "key": "combat",
                "label": "Combate",
                "sections": [
                    {"key": "weapons", "label": "Armas", "fields": ["weapons"]},
                ],
            },
        ],
    }

    def __init__(self, conn):
        self.conn = conn
        self.init_table()

    def init_table(self):
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS character_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT NOT NULL UNIQUE,
                label TEXT NOT NULL,
                schema_json TEXT NOT NULL DEFAULT '{}',
                active INTEGER NOT NULL DEFAULT 0
            )
        """)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS character_template_fields (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                template_id INTEGER NOT NULL,
                key TEXT NOT NULL,
                label TEXT NOT NULL,
                field_type TEXT NOT NULL DEFAULT 'text',
                default_value TEXT NOT NULL DEFAULT '',
                group_label TEXT NOT NULL DEFAULT '',
                favorite INTEGER NOT NULL DEFAULT 0,
                config TEXT NOT NULL DEFAULT '{}',
                sort_order INTEGER NOT NULL DEFAULT 0,
                UNIQUE(template_id, key),
                FOREIGN KEY(template_id) REFERENCES character_templates(id)
            )
        """)
        self._ensure_columns()
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS player_template_values (
                player_id INTEGER NOT NULL,
                field_id INTEGER NOT NULL,
                value TEXT NOT NULL DEFAULT '',
                PRIMARY KEY(player_id, field_id),
                FOREIGN KEY(player_id) REFERENCES players(id),
                FOREIGN KEY(field_id) REFERENCES character_template_fields(id)
            )
        """)
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS character_template_values (
                character_id INTEGER NOT NULL,
                field_id INTEGER NOT NULL,
                value TEXT NOT NULL DEFAULT '',
                PRIMARY KEY(character_id, field_id),
                FOREIGN KEY(character_id) REFERENCES player_characters(id),
                FOREIGN KEY(field_id) REFERENCES character_template_fields(id)
            )
        """)

        self._seed_templates()
        self.conn.commit()

    def _ensure_columns(self):
        columns = {
            row["name"]
            for row in self.conn.execute("PRAGMA table_info(character_template_fields)").fetchall()
        }

        if "favorite" not in columns:
            self.conn.execute(
                "ALTER TABLE character_template_fields ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0"
            )

        if "config" not in columns:
            self.conn.execute(
                "ALTER TABLE character_template_fields ADD COLUMN config TEXT NOT NULL DEFAULT '{}'"
            )

        template_columns = {
            row["name"]
            for row in self.conn.execute("PRAGMA table_info(character_templates)").fetchall()
        }

        if "schema_json" not in template_columns:
            self.conn.execute(
                "ALTER TABLE character_templates ADD COLUMN schema_json TEXT NOT NULL DEFAULT '{}'"
            )

    def _seed_templates(self):
        had_basic_template = self._template_id("personaje_basico") is not None
        templates = [
            ("personaje_basico", "Personaje básico"),
            ("pathfinder_2e", "Pathfinder 2e"),
        ]

        for key, label in templates:
            self.conn.execute(
                """
                INSERT OR IGNORE INTO character_templates (key, label, active)
                VALUES (?, ?, 0)
                """,
                (key, label),
            )

        active = self.conn.execute(
            "SELECT id, key FROM character_templates WHERE active = 1 LIMIT 1"
        ).fetchone()

        if active is None or (active["key"] == "pathfinder_2e" and not had_basic_template):
            self.conn.execute(
                "UPDATE character_templates SET active = 0"
            )
            self.conn.execute(
                "UPDATE character_templates SET active = 1 WHERE key = ?",
                ("personaje_basico",),
            )

        basic_id = self._template_id("personaje_basico")
        self.conn.execute(
            """
            UPDATE character_templates
            SET schema_json = ?, label = ?
            WHERE key = ?
            """,
            (self._serialize_schema(self.BASIC_CHARACTER_SCHEMA), "Personaje básico", "personaje_basico"),
        )
        self._ensure_schema_fields(basic_id, self.BASIC_CHARACTER_SCHEMA)

        pathfinder_id = self._template_id("pathfinder_2e")
        self.conn.execute(
            """
            UPDATE character_templates
            SET schema_json = ?
            WHERE key = ?
            """,
            (self._serialize_schema(self.PATHFINDER_2E_SCHEMA), "pathfinder_2e"),
        )
        self._ensure_schema_fields(pathfinder_id, self.PATHFINDER_2E_SCHEMA)
        self._cleanup_pathfinder_legacy_fields(pathfinder_id)

    def _cleanup_pathfinder_legacy_fields(self, template_id: int | None):
        if template_id is None:
            return

        self._migrate_field_value(template_id, "hp", "current_hp")
        self._migrate_field_value(template_id, "ac", "armor_class")

        legacy_ids = [
            row["id"]
            for row in self.conn.execute(
                """
                SELECT id
                FROM character_template_fields
                WHERE template_id = ?
                  AND key IN ('hp', 'ac')
                """,
                (template_id,),
            ).fetchall()
        ]

        for field_id in legacy_ids:
            self.conn.execute("DELETE FROM player_template_values WHERE field_id = ?", (field_id,))
            self.conn.execute("DELETE FROM character_template_values WHERE field_id = ?", (field_id,))
            self.conn.execute("DELETE FROM character_template_fields WHERE id = ?", (field_id,))

    def _migrate_field_value(self, template_id: int, old_key: str, new_key: str):
        old_field = self.conn.execute(
            "SELECT id FROM character_template_fields WHERE template_id = ? AND key = ?",
            (template_id, old_key),
        ).fetchone()
        new_field = self.conn.execute(
            "SELECT id FROM character_template_fields WHERE template_id = ? AND key = ?",
            (template_id, new_key),
        ).fetchone()

        if old_field is None or new_field is None:
            return

        rows = self.conn.execute(
            """
            SELECT player_id, value
            FROM player_template_values
            WHERE field_id = ?
            """,
            (old_field["id"],),
        ).fetchall()

        for row in rows:
            existing = self.conn.execute(
                """
                SELECT value
                FROM player_template_values
                WHERE player_id = ? AND field_id = ?
                """,
                (row["player_id"], new_field["id"]),
            ).fetchone()

            if existing is not None and str(existing["value"]).strip() not in ("", "0"):
                continue

            self.conn.execute(
                """
                INSERT INTO player_template_values (player_id, field_id, value)
                VALUES (?, ?, ?)
                ON CONFLICT(player_id, field_id) DO UPDATE SET value = excluded.value
                """,
                (row["player_id"], new_field["id"], row["value"]),
            )

    def _ensure_schema_fields(self, template_id: int | None, schema: dict):
        if template_id is None or not isinstance(schema, dict):
            return

        fields = schema.get("fields")
        if not isinstance(fields, list):
            return

        sections_by_field = {}
        for page in schema.get("pages") or []:
            if not isinstance(page, dict):
                continue

            for section in page.get("sections") or []:
                if not isinstance(section, dict):
                    continue

                section_label = str(section.get("label", "")).strip()
                for field_key in section.get("fields") or []:
                    sections_by_field.setdefault(str(field_key), section_label)

        for index, field in enumerate(fields):
            if not isinstance(field, dict):
                continue

            key = self._clean_key(str(field.get("key", "")))
            label = str(field.get("label", "")).strip()

            if not key or not label:
                continue

            field_type = self._schema_field_type(field)
            item_fields = []
            item_template = field.get("itemTemplate") if isinstance(field.get("itemTemplate"), dict) else {}
            for item_index, item_field in enumerate(item_template.get("fields") or []):
                if not isinstance(item_field, dict):
                    continue

                item_fields.append({
                    "key": item_field.get("key", ""),
                    "label": item_field.get("label", ""),
                    "type": self._schema_field_type(item_field),
                    "defaultValue": item_field.get("default", ""),
                    "formula": item_field.get("formula", ""),
                    "options": item_field.get("options", ""),
                    "sortOrder": (item_index + 1) * 10,
                })

            config = self._serialize_config({
                "itemFields": item_fields,
                "formula": field.get("formula", ""),
            })
            default_value = field.get("default", "[]" if field_type == "array" else "")

            self.conn.execute(
                """
                INSERT INTO character_template_fields (
                    template_id, key, label, field_type, default_value, group_label, favorite, config, sort_order
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(template_id, key) DO UPDATE SET
                    label = excluded.label,
                    field_type = excluded.field_type,
                    default_value = excluded.default_value,
                    group_label = excluded.group_label,
                    favorite = excluded.favorite,
                    config = excluded.config,
                    sort_order = excluded.sort_order
                """,
                (
                    template_id,
                    key,
                    label,
                    field_type,
                    str(default_value),
                    sections_by_field.get(key, ""),
                    1 if field.get("favorite") else 0,
                    config,
                    (index + 1) * 10,
                ),
            )

    def _schema_field_type(self, field: dict):
        field_type = str(field.get("type", "text")).strip().lower()

        if field_type == "number":
            return "b_int" if field.get("display") == "counter" else "int"

        if field_type == "formula":
            return "formula"

        if field_type == "roll":
            return "throw"

        if field_type == "array":
            return "array"

        if field_type == "cycle":
            return "cycle"

        if field_type in {"long_text", "textarea"}:
            return "long_text"

        if field_type in {"csv", "tags"}:
            return "csv"

        return "text"

    def _template_id(self, key: str):
        row = self.conn.execute(
            "SELECT id FROM character_templates WHERE key = ?",
            (key,),
        ).fetchone()

        return row["id"] if row else None

    def active_template(self):
        row = self.conn.execute(
            """
            SELECT id, key, label, schema_json
            FROM character_templates
            WHERE active = 1
            ORDER BY id
            LIMIT 1
            """
        ).fetchone()

        if row is None:
            return None

        return {
            "id": row["id"],
            "key": row["key"],
            "label": row["label"],
            "schema": self._parse_schema(row["schema_json"]),
            "fields": self.fields_for_template(row["id"]),
        }

    def fields_for_template(self, template_id: int):
        rows = self.conn.execute(
            """
            SELECT id, key, label, field_type, default_value, group_label, favorite, config, sort_order
            FROM character_template_fields
            WHERE template_id = ?
            ORDER BY sort_order ASC, id ASC
            """,
            (template_id,),
        ).fetchall()

        return [
            {
                "id": row["id"],
                "key": row["key"],
                "label": row["label"],
                "type": self._normalize_field_type(row["field_type"]),
                "defaultValue": row["default_value"],
                "group": row["group_label"],
                "favorite": bool(row["favorite"]),
                "config": self._parse_config(row["config"]),
                "sortOrder": row["sort_order"],
            }
            for row in rows
        ]

    def ensure_values_for_player(self, player_id: int, values: dict | None = None):
        template = self.active_template()

        if template is None:
            return

        values = values or {}

        for field in template["fields"]:
            value = self._serialize_value(field, values.get(field["key"], field["defaultValue"]))
            self.conn.execute(
                """
                INSERT OR IGNORE INTO player_template_values (player_id, field_id, value)
                VALUES (?, ?, ?)
                """,
                (player_id, field["id"], value),
            )

            if field["key"] in values:
                self.conn.execute(
                    """
                    UPDATE player_template_values
                    SET value = ?
                    WHERE player_id = ? AND field_id = ?
                    """,
                    (value, player_id, field["id"]),
                )

    def ensure_values_for_character(self, character_id: int, template_id: int, values: dict | None = None):
        template = self.get_template(template_id)

        if template is None:
            return

        values = values or {}

        for field in template["fields"]:
            value = self._serialize_value(field, values.get(field["key"], field["defaultValue"]))
            self.conn.execute(
                """
                INSERT OR IGNORE INTO character_template_values (character_id, field_id, value)
                VALUES (?, ?, ?)
                """,
                (character_id, field["id"], value),
            )

            if field["key"] in values:
                self.conn.execute(
                    """
                    UPDATE character_template_values
                    SET value = ?
                    WHERE character_id = ? AND field_id = ?
                    """,
                    (value, character_id, field["id"]),
                )

    def copy_player_values_to_character(self, player_id: int, character_id: int, template_id: int):
        template = self.get_template(template_id)

        if template is None:
            return

        self.ensure_values_for_character(character_id, template_id)
        self.conn.execute(
            """
            INSERT INTO character_template_values (character_id, field_id, value)
            SELECT ?, field_id, value
            FROM player_template_values
            WHERE player_id = ?
              AND field_id IN (
                SELECT id FROM character_template_fields WHERE template_id = ?
              )
            ON CONFLICT(character_id, field_id) DO UPDATE SET value = excluded.value
            """,
            (character_id, player_id, template_id),
        )

    def all_templates(self):
        rows = self.conn.execute(
            """
            SELECT id, key, label, schema_json, active
            FROM character_templates
            ORDER BY active DESC, label COLLATE NOCASE ASC
            """
        ).fetchall()

        return [
            {
                "id": row["id"],
                "key": row["key"],
                "label": row["label"],
                "schema": self._parse_schema(row["schema_json"]),
                "active": bool(row["active"]),
                "fields": self.fields_for_template(row["id"]),
            }
            for row in rows
        ]

    def create_template(self, key: str, label: str, schema: dict | None = None):
        key = self._clean_key(key)
        label = (label or "").strip()
        schema_json = self._serialize_schema(schema or {})

        if not key or not label:
            return {
                "ok": False,
                "mensaje": "Faltan clave o nombre de plantilla.",
            }

        try:
            cursor = self.conn.execute(
                """
                INSERT INTO character_templates (key, label, schema_json, active)
                VALUES (?, ?, ?, 0)
                """,
                (key, label, schema_json),
            )
            if schema:
                self._ensure_schema_fields(cursor.lastrowid, schema)
            self.conn.commit()
        except Exception:
            return {
                "ok": False,
                "mensaje": "No se pudo crear la plantilla. Revisa que la clave no exista.",
            }

        return {
            "ok": True,
            "template": self.get_template(cursor.lastrowid),
        }

    def duplicate_template(self, template_id: int, key: str, label: str, schema: dict | None = None):
        template = self.get_template(template_id)

        if template is None:
            return {
                "ok": False,
                "mensaje": "Plantilla no encontrada.",
            }

        created = self.create_template(key, label, schema if schema is not None else template["schema"])
        if not created["ok"]:
            return created

        new_template_id = created["template"]["id"]
        if created["template"]["fields"]:
            return {
                "ok": True,
                "template": self.get_template(new_template_id),
            }

        for field in template["fields"]:
            self.conn.execute(
                """
                INSERT INTO character_template_fields (
                    template_id, key, label, field_type, default_value, group_label, favorite, config, sort_order
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_template_id,
                    field["key"],
                    field["label"],
                    field["type"],
                    field["defaultValue"],
                    field["group"],
                    1 if field["favorite"] else 0,
                    self._serialize_config(field["config"]),
                    field["sortOrder"],
                ),
            )

        self.conn.commit()

        return {
            "ok": True,
            "template": self.get_template(new_template_id),
        }

    def get_template(self, template_id: int):
        row = self.conn.execute(
            """
            SELECT id, key, label, schema_json, active
            FROM character_templates
            WHERE id = ?
            """,
            (template_id,),
        ).fetchone()

        if row is None:
            return None

        return {
            "id": row["id"],
            "key": row["key"],
            "label": row["label"],
            "schema": self._parse_schema(row["schema_json"]),
            "active": bool(row["active"]),
            "fields": self.fields_for_template(row["id"]),
        }

    def update_template(self, template_id: int, label: str, fields: list[dict] | None, schema: dict | None = None):
        template = self.get_template(template_id)

        if template is None:
            return {
                "ok": False,
                "mensaje": "Plantilla no encontrada.",
            }

        label = (label or "").strip()
        if not label:
            return {
                "ok": False,
                "mensaje": "El nombre de la plantilla es obligatorio.",
            }

        if fields is None:
            if schema is None:
                self.conn.execute(
                    "UPDATE character_templates SET label = ? WHERE id = ?",
                    (label, template_id),
                )
            else:
                self.conn.execute(
                    "UPDATE character_templates SET label = ?, schema_json = ? WHERE id = ?",
                    (label, self._serialize_schema(schema), template_id),
                )
            self.conn.commit()
            return {
                "ok": True,
                "template": self.get_template(template_id),
            }

        clean_fields = []
        keys = set()

        for index, field in enumerate(fields or []):
            key = self._clean_key(str(field.get("key", "")))
            field_label = str(field.get("label", "")).strip()

            if not key or not field_label:
                continue

            if key in keys:
                return {
                    "ok": False,
                    "mensaje": f"Campo duplicado: {key}.",
                }

            keys.add(key)
            clean_fields.append({
                "key": key,
                "label": field_label,
                "field_type": self._normalize_field_type(str(field.get("type", "text"))),
                "default_value": str(field.get("defaultValue", "")),
                "group_label": str(field.get("group", "")).strip(),
                "favorite": 1 if field.get("favorite") else 0,
                "config": self._serialize_config(field.get("config")),
                "sort_order": self._to_int(field.get("sortOrder"), (index + 1) * 10),
            })

        if schema is None:
            self.conn.execute(
                "UPDATE character_templates SET label = ? WHERE id = ?",
                (label, template_id),
            )
        else:
            self.conn.execute(
                "UPDATE character_templates SET label = ?, schema_json = ? WHERE id = ?",
                (label, self._serialize_schema(schema), template_id),
            )
        self.conn.execute(
            """
            DELETE FROM player_template_values
            WHERE field_id IN (
                SELECT id
                FROM character_template_fields
                WHERE template_id = ?
            )
            """,
            (template_id,),
        )
        self.conn.execute(
            """
            DELETE FROM character_template_values
            WHERE field_id IN (
                SELECT id
                FROM character_template_fields
                WHERE template_id = ?
            )
            """,
            (template_id,),
        )
        self.conn.execute(
            "DELETE FROM character_template_fields WHERE template_id = ?",
            (template_id,),
        )

        for field in clean_fields:
            self.conn.execute(
                """
                INSERT INTO character_template_fields (
                    template_id, key, label, field_type, default_value, group_label, favorite, config, sort_order
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    template_id,
                    field["key"],
                    field["label"],
                    field["field_type"],
                    field["default_value"],
                    field["group_label"],
                    field["favorite"],
                    field["config"],
                    field["sort_order"],
                ),
            )

        self.conn.commit()
        self.ensure_values_for_all_players()
        self.ensure_values_for_all_characters()
        self.conn.commit()

        return {
            "ok": True,
            "template": self.get_template(template_id),
        }

    def set_active(self, template_id: int):
        if self.get_template(template_id) is None:
            return {
                "ok": False,
                "mensaje": "Plantilla no encontrada.",
            }

        self.conn.execute("UPDATE character_templates SET active = 0")
        self.conn.execute(
            "UPDATE character_templates SET active = 1 WHERE id = ?",
            (template_id,),
        )
        self.ensure_values_for_all_players()
        self.conn.commit()

        return {
            "ok": True,
            "template": self.get_template(template_id),
        }

    def delete_template(self, template_id: int):
        template = self.get_template(template_id)

        if template is None:
            return {
                "ok": False,
                "mensaje": "Plantilla no encontrada.",
            }

        if template["active"]:
            return {
                "ok": False,
                "mensaje": "No se puede eliminar la plantilla activa.",
            }

        field_ids = [
            row["id"]
            for row in self.conn.execute(
                "SELECT id FROM character_template_fields WHERE template_id = ?",
                (template_id,),
            ).fetchall()
        ]

        for field_id in field_ids:
            self.conn.execute(
                "DELETE FROM player_template_values WHERE field_id = ?",
                (field_id,),
            )
            self.conn.execute(
                "DELETE FROM character_template_values WHERE field_id = ?",
                (field_id,),
            )

        self.conn.execute(
            "DELETE FROM character_template_fields WHERE template_id = ?",
            (template_id,),
        )
        self.conn.execute(
            "DELETE FROM player_characters WHERE template_id = ?",
            (template_id,),
        )
        self.conn.execute(
            "DELETE FROM character_templates WHERE id = ?",
            (template_id,),
        )
        self.conn.commit()

        return {
            "ok": True,
        }

    def update_player_values(self, player_id: int, values: dict):
        self.ensure_values_for_player(player_id, values)
        self.conn.commit()

        return {
            "ok": True,
            "sheet": self.sheet_for_player(player_id),
        }

    def update_character_values(self, character_id: int, values: dict):
        character = self.conn.execute(
            "SELECT template_id FROM player_characters WHERE id = ?",
            (character_id,),
        ).fetchone()

        if character is None:
            return {
                "ok": False,
                "mensaje": "Personaje no encontrado.",
            }

        self.ensure_values_for_character(character_id, character["template_id"], values)
        self.conn.commit()

        return {
            "ok": True,
            "sheet": self.sheet_for_character(character_id),
        }

    def ensure_values_for_all_players(self):
        rows = self.conn.execute("SELECT id FROM players").fetchall()

        for row in rows:
            self.ensure_values_for_player(row["id"])

    def ensure_values_for_all_characters(self):
        table = self.conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'player_characters'"
        ).fetchone()

        if table is None:
            return

        rows = self.conn.execute("SELECT id, template_id FROM player_characters").fetchall()

        for row in rows:
            self.ensure_values_for_character(row["id"], row["template_id"])

    def sheet_for_player(self, player_id: int):
        template = self.active_template()

        if template is None:
            return None

        self.ensure_values_for_player(player_id)
        rows = self.conn.execute(
            """
            SELECT f.key, f.label, f.field_type, f.group_label, f.favorite, f.config, f.sort_order, v.value
            FROM character_template_fields f
            LEFT JOIN player_template_values v
              ON v.field_id = f.id AND v.player_id = ?
            WHERE f.template_id = ?
            ORDER BY f.sort_order ASC, f.id ASC
            """,
            (player_id, template["id"]),
        ).fetchall()

        return {
            "template": {
                "id": template["id"],
                "key": template["key"],
                "label": template["label"],
                "schema": template["schema"],
            },
            "fields": [
                {
                    "key": row["key"],
                    "label": row["label"],
                    "type": self._normalize_field_type(row["field_type"]),
                    "group": row["group_label"],
                    "favorite": bool(row["favorite"]),
                    "config": self._parse_config(row["config"]),
                    "value": self._deserialize_value(row["field_type"], row["value"]),
                    "sortOrder": row["sort_order"],
                }
                for row in rows
            ],
        }

    def sheet_for_character(self, character_id: int):
        character = self.conn.execute(
            """
            SELECT template_id
            FROM player_characters
            WHERE id = ?
            """,
            (character_id,),
        ).fetchone()

        if character is None:
            return None

        template = self.get_template(character["template_id"])

        if template is None:
            return None

        self.ensure_values_for_character(character_id, template["id"])
        rows = self.conn.execute(
            """
            SELECT f.key, f.label, f.field_type, f.group_label, f.favorite, f.config, f.sort_order, v.value
            FROM character_template_fields f
            LEFT JOIN character_template_values v
              ON v.field_id = f.id AND v.character_id = ?
            WHERE f.template_id = ?
            ORDER BY f.sort_order ASC, f.id ASC
            """,
            (character_id, template["id"]),
        ).fetchall()

        return {
            "template": {
                "id": template["id"],
                "key": template["key"],
                "label": template["label"],
                "schema": template["schema"],
            },
            "fields": [
                {
                    "key": row["key"],
                    "label": row["label"],
                    "type": self._normalize_field_type(row["field_type"]),
                    "group": row["group_label"],
                    "favorite": bool(row["favorite"]),
                    "config": self._parse_config(row["config"]),
                    "value": self._deserialize_value(row["field_type"], row["value"]),
                    "sortOrder": row["sort_order"],
                }
                for row in rows
            ],
        }

    def _normalize_field_type(self, field_type: str):
        field_type = (field_type or "text").strip().lower()

        if field_type == "number":
            field_type = "int"

        if re.fullmatch(r"d[1-9]\d*_throw_int", field_type):
            return field_type

        return field_type if field_type in self.FIELD_TYPES else "text"

    def _serialize_config(self, config):
        if not isinstance(config, dict):
            config = {}

        item_fields = []
        formula = str(config.get("formula", "")).strip()

        for index, field in enumerate(config.get("itemFields") or []):
            if not isinstance(field, dict):
                continue

            key = self._clean_key(str(field.get("key", "")))
            label = str(field.get("label", "")).strip()

            if not key or not label:
                continue

            item_fields.append({
                "key": key,
                "label": label,
                "type": self._normalize_field_type(str(field.get("type", "text"))),
                "defaultValue": str(field.get("defaultValue", "")),
                "formula": str(field.get("formula", "")).strip(),
                "options": str(field.get("options", "")).strip(),
                "sortOrder": self._to_int(field.get("sortOrder"), (index + 1) * 10),
            })

        return json.dumps({"itemFields": item_fields, "formula": formula}, ensure_ascii=False)

    def _parse_config(self, raw_config):
        try:
            config = json.loads(raw_config or "{}")
        except json.JSONDecodeError:
            config = {}

        if not isinstance(config, dict):
            config = {}

        item_fields = config.get("itemFields")
        if not isinstance(item_fields, list):
            item_fields = []

        return {
            "formula": str(config.get("formula", "")),
            "itemFields": [
                {
                    "key": str(field.get("key", "")),
                    "label": str(field.get("label", "")),
                    "type": self._normalize_field_type(str(field.get("type", "text"))),
                    "defaultValue": str(field.get("defaultValue", "")),
                    "formula": str(field.get("formula", "")),
                    "options": str(field.get("options", "")),
                    "sortOrder": self._to_int(field.get("sortOrder"), (index + 1) * 10),
                }
                for index, field in enumerate(item_fields)
                if isinstance(field, dict)
            ],
        }

    def _serialize_schema(self, schema):
        if not isinstance(schema, dict):
            schema = {}

        return json.dumps(schema, ensure_ascii=False)

    def _parse_schema(self, raw_schema):
        try:
            schema = json.loads(raw_schema or "{}")
        except json.JSONDecodeError:
            schema = {}

        return schema if isinstance(schema, dict) else {}

    def _serialize_value(self, field: dict, value):
        if field["type"] == "array":
            if isinstance(value, str):
                try:
                    parsed = json.loads(value)
                except json.JSONDecodeError:
                    parsed = []
                value = parsed

            if not isinstance(value, list):
                value = []

            return json.dumps(value, ensure_ascii=False)

        return str(value)

    def _deserialize_value(self, field_type: str, value):
        if self._normalize_field_type(field_type) != "array":
            return value or ""

        try:
            parsed = json.loads(value or "[]")
        except json.JSONDecodeError:
            parsed = []

        return parsed if isinstance(parsed, list) else []

    def _clean_key(self, key: str):
        cleaned = []

        for char in (key or "").strip().lower():
            if char.isalnum():
                cleaned.append(char)
            elif char in {"_", "-", " "}:
                cleaned.append("_")

        return "".join(cleaned).strip("_")

    def _to_int(self, value, fallback: int):
        try:
            return int(value)
        except (TypeError, ValueError):
            return fallback
