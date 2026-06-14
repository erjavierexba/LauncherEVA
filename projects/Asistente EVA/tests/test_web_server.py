import sqlite3
import unittest
from types import SimpleNamespace

from src.db_domains.character_templates import CharacterTemplatesRepository
from src.db_domains.players import PlayersRepository

try:
    from src.web_server import (
        DOOR_CHALLENGES,
        EXCHANGE_POSTS,
        active_door_challenges_for_user,
        active_exchange_post_for_user,
        character_sheet_update_event,
        template_update_event,
    )
except ModuleNotFoundError as error:
    if error.name != "aiohttp":
        raise
    DOOR_CHALLENGES = None
    EXCHANGE_POSTS = None
    active_door_challenges_for_user = None
    active_exchange_post_for_user = None
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

        self.assertEqual(event["tipo"], "CHARACTER_SHEET_UPDATE")
        self.assertEqual(event["destinatario"], "Ale")
        self.assertEqual(event["valor"]["username"], "Ale")
        self.assertEqual(event["valor"]["fields"], ["hp"])

    def test_active_state_helpers_only_return_player_items(self):
        DOOR_CHALLENGES.clear()
        EXCHANGE_POSTS.clear()
        self.addCleanup(DOOR_CHALLENGES.clear)
        self.addCleanup(EXCHANGE_POSTS.clear)

        DOOR_CHALLENGES["door-1"] = {
            "id": "door-1",
            "status": "active",
            "participants": ["Ale", "Bea"],
        }
        DOOR_CHALLENGES["door-2"] = {
            "id": "door-2",
            "status": "cancelled",
            "participants": ["Ale"],
        }
        EXCHANGE_POSTS["exchange-1"] = {
            "id": "exchange-1",
            "status": "active",
            "participants": ["Ale", "Bea"],
        }

        self.assertEqual([item["id"] for item in active_door_challenges_for_user("Ale")], ["door-1"])
        self.assertIs(active_exchange_post_for_user("Ale"), EXCHANGE_POSTS["exchange-1"])
        self.assertEqual(active_door_challenges_for_user("Cris"), [])
        self.assertIsNone(active_exchange_post_for_user("Cris"))


if __name__ == "__main__":
    unittest.main()
