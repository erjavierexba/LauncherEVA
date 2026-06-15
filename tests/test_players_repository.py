import sqlite3
import unittest

from src.db_domains.character_templates import CharacterTemplatesRepository
from src.db_domains.players import PlayersRepository


class PlayersRepositoryTest(unittest.TestCase):
    def create_connection(self):
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        return conn

    def test_migrates_legacy_players_table(self):
        conn = self.create_connection()
        conn.execute("""
            CREATE TABLE players (
                username TEXT PRIMARY KEY,
                active INTEGER NOT NULL DEFAULT 1,
                eliminated_at TEXT NULL
            )
        """)
        conn.execute(
            "INSERT INTO players (username, active) VALUES (?, ?)",
            ("Visitante", 1),
        )

        repo = PlayersRepository(conn)
        columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(players)").fetchall()
        }

        self.assertTrue({"id", "nombre", "aliases", "npc"}.issubset(columns))
        self.assertEqual(repo.get("Visitante")["nombre"], "Visitante")
        self.assertFalse(repo.get("Visitante")["npc"])

    def test_creates_generic_user_with_aliases(self):
        conn = self.create_connection()
        players = PlayersRepository(conn)

        result = players.create_user("Guardia", ["centinela", "portero"])
        self.assertTrue(result["ok"])
        self.assertFalse(players.get("Guardia")["npc"])
        self.assertEqual(players.get("Guardia")["aliases"], ["centinela", "portero"])

    def test_config_aliases_are_merged_without_overwriting_existing_aliases(self):
        conn = self.create_connection()
        PlayersRepository(conn, [{"name": "Ale", "aliases": ["ale"]}])
        players = PlayersRepository(conn, [{"name": "Ale", "aliases": ["alex"]}])

        self.assertEqual(players.get("Ale")["aliases"], ["ale", "alex"])

    def test_basic_template_is_default_but_manual_pathfinder_activation_is_preserved(self):
        conn = self.create_connection()
        templates = CharacterTemplatesRepository(conn)
        self.assertEqual(templates.active_template()["key"], "personaje_basico")

        conn.execute("UPDATE character_templates SET active = 0")
        conn.execute("UPDATE character_templates SET active = 1 WHERE key = ?", ("pathfinder_2e",))
        conn.commit()

        templates = CharacterTemplatesRepository(conn)
        self.assertEqual(templates.active_template()["key"], "pathfinder_2e")

    def test_creates_multiple_characters_for_player_and_template(self):
        conn = self.create_connection()
        templates = CharacterTemplatesRepository(conn)
        players = PlayersRepository(conn, [{"name": "Ale"}], templates)
        player = players.get("Ale")

        self.assertEqual(templates.active_template()["key"], "personaje_basico")
        self.assertEqual(templates.active_template()["fields"], [])

        first = players.create_character(player["id"], "Kira", "Exploradora", {"class": "Ranger"})
        second = players.create_character(player["id"], "Nox", "Mago", {"class": "Wizard"})

        self.assertTrue(first["ok"])
        self.assertTrue(second["ok"])
        self.assertEqual(first["personaje"]["playerName"], "Ale")
        self.assertEqual(first["personaje"]["role"], "Exploradora")
        self.assertEqual(len(players.characters_for_player(player["id"])), 3)
        self.assertEqual(templates.sheet_for_character(first["personaje"]["id"])["fields"], [])

    def test_creates_character_with_notes_for_selected_template(self):
        conn = self.create_connection()
        templates = CharacterTemplatesRepository(conn)
        created_template = templates.create_template("manual_custom", "Manual custom", {
            "id": "manual_custom",
            "name": "Manual custom",
            "fields": [{"key": "concept", "label": "Concepto", "type": "text"}],
            "pages": [],
        })["template"]
        players = PlayersRepository(conn, [{"name": "Ale"}], templates)
        player = players.get("Ale")

        result = players.create_character(
            player["id"],
            "Kira",
            fields={"concept": "Exploradora"},
            notes="Tiene una deuda pendiente.",
            template_id=created_template["id"],
        )

        self.assertTrue(result["ok"])
        self.assertEqual(result["personaje"]["notes"], "Tiene una deuda pendiente.")
        self.assertEqual(result["personaje"]["template"]["key"], "manual_custom")
        self.assertEqual(templates.sheet_for_character(result["personaje"]["id"])["fields"][0]["value"], "Exploradora")

    def test_updates_character_name_and_notes(self):
        conn = self.create_connection()
        templates = CharacterTemplatesRepository(conn)
        players = PlayersRepository(conn, [{"name": "Ale"}], templates)
        player = players.get("Ale")
        created = players.create_character(player["id"], "Kira")

        result = players.update_character(created["personaje"]["id"], name="Kira Nox", notes="Nota nueva")

        self.assertTrue(result["ok"])
        self.assertEqual(result["personaje"]["nombre"], "Kira Nox")
        self.assertEqual(result["personaje"]["notes"], "Nota nueva")

    def test_deletes_character_without_deleting_player(self):
        conn = self.create_connection()
        templates = CharacterTemplatesRepository(conn)
        players = PlayersRepository(conn, [{"name": "Ale"}], templates)
        player = players.get("Ale")
        created = players.create_character(player["id"], "Kira", "Exploradora")

        result = players.delete_character(created["personaje"]["id"])

        self.assertTrue(result["ok"])
        self.assertIsNotNone(players.get("Ale"))
        self.assertIsNone(players.get_character(created["personaje"]["id"]))

    def test_formula_fields_keep_formula_and_favorite_flag(self):
        conn = self.create_connection()
        templates = CharacterTemplatesRepository(conn)
        result = templates.create_template("test_rolls", "Test rolls", {
            "id": "test_rolls",
            "name": "Test rolls",
            "fields": [
                {"key": "level", "label": "Nivel", "type": "number", "default": 2},
                {"key": "strike", "label": "Golpe", "type": "formula", "formula": "d20+level", "favorite": True},
            ],
            "pages": [],
        })

        self.assertTrue(result["ok"])
        field = next(field for field in result["template"]["fields"] if field["key"] == "strike")
        self.assertEqual(field["type"], "formula")
        self.assertEqual(field["config"]["formula"], "d20+level")
        self.assertTrue(field["favorite"])

    def test_template_pages_and_sections_are_preserved(self):
        conn = self.create_connection()
        templates = CharacterTemplatesRepository(conn)
        schema = {
            "id": "sectioned",
            "name": "Sectioned",
            "fields": [
                {"key": "name", "label": "Nombre", "type": "text"},
                {"key": "hp", "label": "PG", "type": "number"},
            ],
            "pages": [
                {
                    "key": "front",
                    "label": "Portada",
                    "sections": [
                        {"key": "identity", "label": "Identidad", "fields": ["name"]},
                        {"key": "combat", "label": "Combate", "fields": ["hp"]},
                    ],
                },
            ],
        }

        result = templates.create_template("sectioned", "Sectioned", schema)

        self.assertTrue(result["ok"])
        page = result["template"]["schema"]["pages"][0]
        self.assertEqual(page["label"], "Portada")
        self.assertEqual([section["key"] for section in page["sections"]], ["identity", "combat"])

    def test_template_label_update_keeps_existing_fields(self):
        conn = self.create_connection()
        templates = CharacterTemplatesRepository(conn)
        result = templates.create_template("label_only", "Label only", {
            "id": "label_only",
            "name": "Label only",
            "fields": [
                {"key": "hp", "label": "PG", "type": "number", "default": 10},
            ],
            "pages": [],
        })

        self.assertTrue(result["ok"])
        field_id = result["template"]["fields"][0]["id"]

        updated = templates.update_template(result["template"]["id"], "Label updated", None)

        self.assertTrue(updated["ok"])
        self.assertEqual(updated["template"]["label"], "Label updated")
        self.assertEqual(updated["template"]["fields"][0]["id"], field_id)


if __name__ == "__main__":
    unittest.main()
