from src.commands.broma import BromaCommand
from src.commands.consulta import ConsultaCommand
from src.commands.countdown import CountdownCommand
from src.commands.ejecuta import EjecutaCommand
from src.commands.mostrar_archivo import MostrarArchivoCommand
from src.commands.music_control import MusicControlCommand
from src.commands.musica import MusicCommand


def crear_comando(info):
    tipo = info["tipo"]
    objetivo = info["objetivo"]

    if tipo == "MUESTRA":
        return MostrarArchivoCommand()

    if tipo == "MUSICA":
        return MusicCommand(objetivo)

    if tipo == "MUSICA_CONTROL":
        return MusicControlCommand(objetivo)

    if tipo == "COUNTDOWN":
        return CountdownCommand(objetivo)

    if tipo == "CONSULTA":
        return ConsultaCommand(objetivo)

    if tipo == "EJECUTA":
        return EjecutaCommand(objetivo)

    if tipo == "BROMA":
        return BromaCommand(objetivo)

    return None
