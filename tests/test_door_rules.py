import unittest

from src.domain.door_rules import evaluate_door


class DoorRulesTest(unittest.TestCase):
    def test_joker_can_complete_figure_pair(self):
        result = evaluate_door(
            [
                {"valor": "jota de picas", "owner": "Ale"},
                {"valor": "joker", "owner": "Fran"},
            ],
            {
                "combination": "pair",
                "rankFilter": "figures",
            },
        )

        self.assertGreater(result["matchCount"], 0)
        match = result["matches"][0]
        self.assertEqual(match["label"], "jota")
        self.assertTrue(any(card["jokerAs"]["rank"] == 11 for card in match["cards"] if card["jokerAs"]))

    def test_figures_are_not_even_or_odd(self):
        result = evaluate_door(
            [
                {"valor": "jota de picas", "owner": "Ale"},
                {"valor": "jota de corazones", "owner": "Fran"},
            ],
            {
                "combination": "pair",
                "parity": "even",
            },
        )

        self.assertEqual(result["matchCount"], 0)

    def test_short_straight_can_use_joker(self):
        result = evaluate_door(
            [
                {"valor": "4 de picas", "owner": "Ale"},
                {"valor": "5 de corazones", "owner": "Fran"},
                {"valor": "joker dorado", "owner": "Jose"},
            ],
            {
                "combination": "straight",
                "straightLength": 3,
            },
        )

        self.assertGreater(result["matchCount"], 0)
        self.assertTrue(
            any(
                card["jokerAs"] and card["jokerAs"]["rank"] in (3, 6)
                for match in result["matches"]
                for card in match["cards"]
            )
        )

    def test_at_least_three_odd_cards(self):
        result = evaluate_door(
            [
                {"valor": "3 de picas", "owner": "Ale"},
                {"valor": "5 de corazones", "owner": "Fran"},
                {"valor": "7 de treboles", "owner": "Jose"},
                {"valor": "10 de diamantes", "owner": "Mara"},
            ],
            {
                "combination": "at_least",
                "groupSize": 4,
                "atLeastCount": 3,
                "atLeastKind": "odd",
            },
        )

        self.assertGreater(result["matchCount"], 0)
        self.assertEqual(result["matches"][0]["label"], "al menos 3 impares")

    def test_at_least_three_figures_can_use_joker(self):
        result = evaluate_door(
            [
                {"valor": "jota de picas", "owner": "Ale"},
                {"valor": "reina de corazones", "owner": "Fran"},
                {"valor": "joker", "owner": "Jose"},
            ],
            {
                "combination": "at_least",
                "groupSize": 3,
                "atLeastCount": 3,
                "atLeastKind": "figures",
            },
        )

        self.assertGreater(result["matchCount"], 0)


if __name__ == "__main__":
    unittest.main()
