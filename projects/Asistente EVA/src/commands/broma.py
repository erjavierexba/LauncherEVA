MENSAJES = {
    "guapa": "¡El barrio entero para ti pa la calle reina!",
}


class BromaCommand:
    nombre = "BROMA"

    def __init__(self, objetivo: str):
        self.objetivo = objetivo

    def iniciar(self, decir):
        mensaje = MENSAJES.get(self.objetivo)

        if mensaje:
            decir(mensaje)

        return None

    def procesar(self, texto, decir):
        return None
