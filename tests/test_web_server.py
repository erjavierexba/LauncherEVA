import sqlite3
import unittest
from types import SimpleNamespace

from src.db_domains.character_templates import CharacterTemplatesRepository
from src.db_domains.players import PlayersRepository

try:
    from src.web_server import (
        character_sheet_update_event,
        template_update_event,
    )
except ModuleNotFoundError as error:
    if error.name != "aiohttp":
        raise
    character_sheet_update_event = None
    template_update_event = None


@unittest.skipIf(template_update_event is None, "aiohttp no está instalado")
class WebServerTest(unittest.TestCase):
    def create_connection(self):
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        return conn

    def test_template_update_event_includes_active_template_and_sheets(self):
        conn = self.create_connection()
        templates = CharacterTemplatesRepository(conn)
        players = PlayersRepository(conn, templates)

        conn.execute("UPDATE character_templates SET active = 0")
        conn.execute("UPDATE character_templates SET active = 1 WHERE key = ?", ("pathfinder_2e",))
        conn.commit()
        players.create_npc("Merisiel", {"class": "Pícara"})
        players.eliminate("Bob")

        db = SimpleNamespace(character_templates=templates, players=players)
        event = template_update_event(db)
        characters = {character["nombre"]: character for character in event["valor"]["characters"]}

        self.assertEqual(event["tipo"], "TEMPLATE_UPDATE")
        self.assertEqual(event["destinatario"], "TODOS")
        self.assertEqual(event["valor"]["template"]["key"], "pathfinder_2e")
        self.assertIn("Merisiel", characters)
        self.assertNotIn("Bob", characters)
        self.assertEqual(characters["Merisiel"]["sheet"]["template"]["key"], "pathfinder_2e")

    def test_character_sheet_update_event_targets_updated_character(self):
        event = character_sheet_update_event("Ale", {"fields": []}, {"hp": "9"})

        self.assertEqual(event["user"], "Ale")
        self.assertIsNone(event["character"])
        self.assertIsNone(event["template"])
        self.assertEqual(event["fieldId"], "hp")
        self.assertEqual(event["value"], "9")

if __name__ == "__main__":
    unittest.main()
