import re
from datetime import datetime, timedelta, timezone

from src.app_context import get_app_context
from src.domain.players import detectar_destinatario


class CountdownCommand:
    nombre = "COUNTDOWN"

    def __init__(self, objetivo: str):
        self.objetivo = objetivo

    def iniciar(self, decir):
        duration_seconds = parse_duration_seconds(self.objetivo)

        if duration_seconds is None:
            mensaje = "No he entendido la duración del temporizador."
            decir(mensaje)
            return {
                "tipo": "ERROR",
                "mensaje": mensaje,
            }

        destinatario = detectar_destinatario(self.objetivo, allow_broadcast=True)

        if destinatario is None:
            destinatario = "TODOS"

        if destinatario != "TODOS" and not get_app_context().db.players.is_active(destinatario):
            mensaje = f"{destinatario} está eliminado."
            decir(mensaje)
            return {
                "tipo": "ERROR",
                "mensaje": mensaje,
            }

        target_at = datetime.now(timezone.utc) + timedelta(seconds=duration_seconds)
        label = clean_label(self.objetivo)

        decir(
            f"Temporizador de {format_duration(duration_seconds)} "
            f"para {format_recipient(destinatario)}."
        )

        return {
            "tipo": "COUNTDOWN",
            "destinatario": destinatario,
            "valor": {
                "durationSeconds": duration_seconds,
                "targetAt": target_at.isoformat(),
                "label": label,
            },
        }


def parse_duration_seconds(texto: str):
    match = re.search(
        r"\b(\d+)\s*(segundo|segundos|s|minuto|minutos|min|m)\b",
        texto,
    )

    if not match:
        return None

    amount = int(match.group(1))
    unit = match.group(2)

    if unit in ("minuto", "minutos", "min", "m"):
        amount *= 60

    return max(1, amount)


def clean_label(texto: str):
    label = re.sub(
        r"\b\d+\s*(?:segundo|segundos|s|minuto|minutos|min|m)\b",
        "",
        texto,
    )
    aliases = {"para", "a", "todos", "todas", "todo"}

    try:
        context = get_app_context()
        for user in context.db.players.all():
            aliases.add(user["nombre"].lower())
            aliases.update(alias.lower() for alias in user.get("aliases", []))
    except RuntimeError:
        pass

    if aliases:
        label = re.sub(rf"\b(?:{'|'.join(re.escape(alias) for alias in aliases)})\b", "", label)

    label = re.sub(r"\s+", " ", label).strip()

    return label or "Temporizador"


def format_duration(seconds: int):
    if seconds % 60 == 0 and seconds >= 60:
        minutes = seconds // 60
        return f"{minutes} minuto" if minutes == 1 else f"{minutes} minutos"

    return f"{seconds} segundo" if seconds == 1 else f"{seconds} segundos"


def format_recipient(destinatario: str):
    if destinatario == "TODOS":
        return "todos"

    return destinatario
