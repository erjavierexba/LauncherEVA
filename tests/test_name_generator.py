import unittest

from src.domain.name_generator import generate_names


class NameGeneratorTest(unittest.TestCase):
    def test_generates_ten_names_for_supported_categories(self):
        for category, subtype, gender in (
            ("persona", "es", "female"),
            ("fantasia", "elfo", "any"),
            ("ciudad", "ciudad", "any"),
        ):
            with self.subTest(category=category):
                names = generate_names(category, subtype, gender, seed=7)

                self.assertEqual(len(names), 10)
                self.assertTrue(all(isinstance(name, str) and name for name in names))


if __name__ == "__main__":
    unittest.main()
