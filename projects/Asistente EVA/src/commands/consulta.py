class ConsultaCommand:
    nombre = "CONSULTA"

    def __init__(self, objetivo: str):
        self.objetivo = objetivo

    def iniciar(self, decir):
        decir(f"Consultando {self.objetivo}.")
        print(f"ACCION: consultar en base de datos/wiki -> {self.objetivo}")
        return None

    def procesar(self, texto, decir):
        return None
