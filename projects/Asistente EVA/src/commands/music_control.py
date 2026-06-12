from src.app_context import get_app_context


class MusicControlCommand:
    nombre = "MUSICA_CONTROL"

    def __init__(self, objetivo: str):
        self.objetivo = objetivo.lower().strip()

    def iniciar(self, decir):
        music_service = get_app_context().music_service

        if "sube" in self.objetivo or "subir" in self.objetivo or "arriba" in self.objetivo or self.objetivo == "volume up":
            result = music_service.volume_up()
        elif "baja" in self.objetivo or "bajar" in self.objetivo or "abajo" in self.objetivo or self.objetivo == "volume down":
            result = music_service.volume_down()
        elif "para" in self.objetivo or "deten" in self.objetivo or "stop" in self.objetivo:
            result = music_service.stop()
        else:
            result = {
                "ok": False,
                "mensaje": "No he entendido el control de música.",
            }

        decir(result["mensaje"])

        if not result["ok"]:
            return {
                "tipo": "ERROR",
                "mensaje": result["mensaje"],
            }

        return {
            "tipo": "MUSICA_CONTROL",
            "destinatario": "Eva",
            "valor": self.objetivo,
            "mensaje": result["mensaje"],
        }

    def procesar(self, texto, decir):
        return None
