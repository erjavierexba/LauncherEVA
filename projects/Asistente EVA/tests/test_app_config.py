import unittest

from src.services.app_config import merge_config
from src.services.firebase_web_config import public_firebase_web_config


class AppConfigTest(unittest.TestCase):
    def test_merge_preserves_firebase_web_config(self):
        config = merge_config({
            "audio": {
                "inputDeviceId": "3",
                "inputDeviceName": "Mesa USB",
            },
            "network": {
                "webPort": "18080",
                "horusPort": "18081",
                "wsPort": "18765",
            },
            "firebase": {
                "serviceAccountPath": "config/custom.json",
                "web": {
                    "vapidPublicKey": "public-key",
                    "vapidPrivateKey": "private-key",
                    "firebaseConfig": {
                        "apiKey": "api-key",
                        "projectId": "project",
                        "messagingSenderId": "sender",
                        "appId": "app",
                    },
                },
            },
        })

        self.assertEqual(config["audio"]["inputDeviceId"], "3")
        self.assertEqual(config["audio"]["inputDeviceName"], "Mesa USB")
        self.assertEqual(config["network"]["webPort"], 18080)
        self.assertEqual(config["network"]["horusPort"], 18081)
        self.assertEqual(config["network"]["wsPort"], 18765)
        self.assertEqual(config["firebase"]["serviceAccountPath"], "config/custom.json")
        self.assertEqual(config["firebase"]["web"]["vapidPublicKey"], "public-key")
        self.assertEqual(config["firebase"]["web"]["firebaseConfig"]["appId"], "app")

    def test_public_firebase_web_config_hides_private_key(self):
        class Config:
            data = merge_config({
                "firebase": {
                    "web": {
                        "vapidPublicKey": "public-key",
                        "vapidPrivateKey": "private-key",
                        "firebaseConfig": {
                            "apiKey": "api-key",
                            "projectId": "project",
                            "messagingSenderId": "sender",
                            "appId": "app",
                        },
                    },
                },
            })

        data = public_firebase_web_config(Config())

        self.assertTrue(data["configured"])
        self.assertEqual(data["vapidKey"], "public-key")
        self.assertNotIn("vapidPrivateKey", data)


if __name__ == "__main__":
    unittest.main()
