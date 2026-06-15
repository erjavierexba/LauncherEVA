import sqlite3
import unittest

from src.db_domains.cards import CardsRepository


class CardsRepositoryTest(unittest.TestCase):
    def create_repository(self):
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        return CardsRepository(conn)

    def test_transfer_card_moves_owner(self):
        cards = self.create_repository()
        self.assertTrue(cards.assign("3 de picas", "Ale")["ok"])

        result = cards.transfer_card("3 de picas", "Ale", "Fran")

        self.assertTrue(result["ok"])
        self.assertNotIn("3 de picas", cards.get_by_owner("Ale"))
        self.assertIn("3 de picas", cards.get_by_owner("Fran"))
        self.assertEqual(result["accion"]["tipo"], "CARTA")
        self.assertEqual(result["accion"]["destinatario"], "Fran")

    def test_transfer_card_rejects_non_owner(self):
        cards = self.create_repository()
        self.assertTrue(cards.assign("3 de picas", "Ale")["ok"])

        result = cards.transfer_card("3 de picas", "Fran", "Mara")

        self.assertFalse(result["ok"])
        self.assertIn("3 de picas", cards.get_by_owner("Ale"))


if __name__ == "__main__":
    unittest.main()
