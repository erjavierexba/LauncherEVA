import re
import unicodedata


BROADCAST_ALIASES = {
    "todos": "TODOS",
    "todo": "TODOS",
    "todas": "TODOS",
}


def quitar_tildes(texto: str) -> str:
    return "".join(
        c
        for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )


def normalizar(texto: str) -> str:
    texto = quitar_tildes(texto.lower().strip())
    texto = re.sub(r"\s+", " ", texto)
    return texto


def limpiar_prefijo_destinatario(texto: str) -> str:
    texto = normalizar(texto)

    texto = re.sub(
        r"^(?:a|para|enviaselo a|enviasela a|mandaselo a|mandasela a|envialo a|enviala a|mandalo a|mandala a)\s+",
        "",
        texto,
    ).strip()

    return texto


def detectar_jugador(texto: str) -> str | None:
    return detectar_destinatario(texto)


def detectar_destinatario(texto: str, allow_broadcast: bool = False) -> str | None:
    try:
        from src.app_context import get_app_context

        users = get_app_context().db.players.all()
    except RuntimeError:
        users = []

    aliases = {}

    for user in users:
        aliases[normalizar(user["nombre"])] = user["nombre"]

        for alias in user.get("aliases", []):
            aliases[normalizar(alias)] = user["nombre"]

    return detectar_destinatario_en(texto, aliases, allow_broadcast)


def detectar_destinatario_en(
    texto: str,
    aliases: dict[str, str],
    allow_broadcast: bool = False,
) -> str | None:
    texto = limpiar_prefijo_destinatario(texto)

    if allow_broadcast and texto in BROADCAST_ALIASES:
        return BROADCAST_ALIASES[texto]

    if texto in aliases:
        return aliases[texto]

    for palabra in texto.split():
        if allow_broadcast and palabra in BROADCAST_ALIASES:
            return BROADCAST_ALIASES[palabra]
        if palabra in aliases:
            return aliases[palabra]

    return None


def es_jugador_valido(nombre: str) -> bool:
    return detectar_destinatario(nombre) is not None
