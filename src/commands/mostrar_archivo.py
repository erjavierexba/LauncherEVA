import re

from src.app_context import get_app_context
from src.domain.players import detectar_destinatario


def limpiar_nombre_archivo(texto: str):
    texto = texto.lower().strip()

    texto = re.sub(
        r"^(?:el|la|los|las|un|una|unos|unas)\s+",
        "",
        texto,
    ).strip()

    texto = re.sub(
        r"^(?:archivo|documento|imagen|video|vídeo|audio)\s+",
        "",
        texto,
    ).strip()

    return texto


class MostrarArchivoCommand:
    nombre = "MOSTRAR_ARCHIVO"
    conversacional = True

    def __init__(self):
        self.destinatario = None
        self.estado = "ESPERANDO_DESTINATARIO"

    def iniciar(self, decir):
        decir("¿A quién quieres enviarlo?")
        return None

    def procesar(self, texto, decir):
        if self.estado == "ESPERANDO_DESTINATARIO":
            destinatario = detectar_destinatario(texto, allow_broadcast=True)

            if destinatario is None:
                print(f"[DEBUG DESTINATARIO ARCHIVO RAW]: {texto}")
                decir("No he entendido a quién quieres enviarlo.")
                return None

            if destinatario != "TODOS" and not get_app_context().db.players.is_active(destinatario):
                decir(f"{destinatario} no está activo.")
                return None

            self.destinatario = destinatario
            self.estado = "ESPERANDO_ARCHIVO"

            decir("¿Qué archivo quieres enviar?")
            return None

        if self.estado == "ESPERANDO_ARCHIVO":
            nombre_archivo = limpiar_nombre_archivo(texto)
            archivo = get_app_context().media_catalog.find(nombre_archivo)

            if archivo is None:
                print(f"[DEBUG ARCHIVO RAW]: {texto}")
                decir("No he encontrado ese archivo.")
                return None

            decir(f"Enviando {archivo['nombre']}.")

            return {
                "tipo": "MUESTRA",
                "destinatario": self.destinatario,
                "valor": archivo,
            }

        return None
