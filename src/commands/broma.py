MENSAJES = {
    "guapa": "¡El barrio entero para ti pa la calle reina!",
    "hola": "Pa ti mi cola. Te falta calle.",
    "poderio": "En el coño metío.",
    "pedro": "¡Hijo de puta!",
    "duro": "Durísimo",
    "como diria cristian": "Me suda el nabo.",
    "como diria christian": "Me suda el nabo.",
    "limon": "A limón huele mi coño.",
    "limón": "A limón huele mi coño.",
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
