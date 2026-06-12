class EjecutaCommand:
    nombre = "EJECUTA"

    def __init__(self, objetivo: str):
        self.objetivo = objetivo

    def iniciar(self, decir):
        decir(f"Ejecutando {self.objetivo}.")
        print(f"ACCION: ejecutar protocolo/script -> {self.objetivo}")
        return None

    def procesar(self, texto, decir):
        return None
