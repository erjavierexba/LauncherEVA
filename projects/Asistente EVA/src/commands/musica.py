import re

from src.app_context import get_app_context


MUSIC_MAP = {
    "combate": {
        1: "assets/music/combate_1.mp3",
        2: "assets/music/combate_2.mp3",
    },
    "tension": {
        1: "assets/music/tension_1.mp3",
    },
    "exploracion": {
        1: "assets/music/exploracion_1.mp3",
    },
    "despertar": {
        1: "assets/music/despertar.mp3",
    }
}


def parse_music_request(texto: str):
    texto = texto.lower().strip()

    texto = texto.replace("cancion de ", "")
    texto = texto.replace("musica de ", "")
    texto = texto.replace("tema de ", "")

    match = re.search(r"([a-záéíóúñ]+)(?:\s+(\d+))?", texto)

    if not match:
        return None, None

    contexto = match.group(1)
    numero = int(match.group(2)) if match.group(2) else 1

    return contexto, numero


class MusicCommand:
    nombre = "MUSICA"

    def __init__(self, objetivo: str):
        self.objetivo = objetivo

    def iniciar(self, decir):
        contexto, numero = parse_music_request(self.objetivo)

        if not contexto:
            decir("No he entendido qué música quieres reproducir.")
            return {
                "tipo": "ERROR",
                "mensaje": "No he entendido qué música quieres reproducir.",
            }

        canciones = MUSIC_MAP.get(contexto)

        if not canciones:
            mensaje = f"No tengo música registrada para {contexto}."
            decir(mensaje)
            return {
                "tipo": "ERROR",
                "mensaje": mensaje,
            }

        path = canciones.get(numero)

        if not path:
            mensaje = f"No tengo la canción {numero} de {contexto}."
            decir(mensaje)
            return {
                "tipo": "ERROR",
                "mensaje": mensaje,
            }

        etiqueta = f"{contexto} {numero}"
        result = get_app_context().music_service.play(
            path,
            label=etiqueta,
            context=contexto,
            number=numero,
        )

        if not result["ok"]:
            decir(result["mensaje"])
            return {
                "tipo": "ERROR",
                "mensaje": result["mensaje"],
            }

        mensaje = f"Reproduciendo {etiqueta}."
        decir(mensaje)

        return {
            "tipo": "MUSICA",
            "destinatario": "Eva",
            "valor": {
                "contexto": contexto,
                "numero": numero,
                "path": path,
            },
            "mensaje": mensaje,
        }

    def procesar(self, texto, decir):
        return None
