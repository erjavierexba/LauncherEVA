import unittest

from src.services.app_config import merge_config


class AppConfigTest(unittest.TestCase):
    def test_merge_preserves_server_config(self):
        config = merge_config({
            "server": {
                "host": "127.0.0.1",
                "evaPort": 9000,
                "clientPort": "9001",
            },
        })

        self.assertEqual(config["server"]["host"], "127.0.0.1")
        self.assertEqual(config["server"]["evaPort"], 9000)
        self.assertEqual(config["server"]["clientPort"], 9001)

    def test_merge_ignores_invalid_ports(self):
        config = merge_config({
            "server": {
                "evaPort": 0,
                "clientPort": 70000,
            },
        })

        self.assertEqual(config["server"]["evaPort"], 8000)
        self.assertEqual(config["server"]["clientPort"], 8080)

    def test_merge_preserves_database_backup_limit(self):
        config = merge_config({
            "database": {
                "maxBackups": "3",
            },
        })

        self.assertEqual(config["database"]["maxBackups"], 3)


if __name__ == "__main__":
    unittest.main()
