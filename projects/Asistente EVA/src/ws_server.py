import asyncio
import json
import websockets

from src.services.fcm_push import send_pending_notification

CLIENTS = set()


async def handler(websocket, incoming_queue):
    print("[WS] Cliente conectado")
    CLIENTS.add(websocket)

    try:
        async for message in websocket:
            print(f"[WS] Recibido: {message}")

            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                print("[WS] JSON inválido")
                continue

            await incoming_queue.put(data)

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        CLIENTS.discard(websocket)
        print("[WS] Cliente desconectado")


async def broadcast(data: dict):
    if not CLIENTS:
        print("[WS] Sin clientes conectados")
        return

    message = json.dumps(data, ensure_ascii=False)

    disconnected = []

    for client in CLIENTS:
        try:
            await client.send(message)
        except websockets.exceptions.ConnectionClosed:
            disconnected.append(client)

    for client in disconnected:
        CLIENTS.discard(client)

    print(f"[WS] Enviado: {message}")


# 🔥 LOOP QUE ESCUCHA LA COLA
def notification_recipients(context, data: dict):
    tipo = data.get("tipo")
    destinatario = data.get("destinatario")

    if tipo not in (
        "CARTA",
        "MUESTRA",
        "COUNTDOWN",
        "COUNTDOWN_CANCEL",
        "DOOR_CHALLENGE",
        "DOOR_CANCEL",
        "EXCHANGE_OPEN",
        "EXCHANGE_CLOSED",
        "DICE_ROLL",
        "TEMPLATE_UPDATE",
        "CHARACTER_SHEET_UPDATE",
    ):
        return []

    users = [user["nombre"] for user in context.db.players.all() if user["active"]]

    if tipo in ("EXCHANGE_OPEN", "EXCHANGE_CLOSED"):
        value = data.get("valor") if isinstance(data.get("valor"), dict) else {}
        participants = value.get("playerParticipants") or value.get("participants") or []
        return [
            username
            for username in users
            if username in participants and not context.db.players.is_npc(username)
        ]

    if destinatario == "TODOS":
        return users

    if isinstance(destinatario, str) and destinatario in users:
        return [destinatario]

    return []


async def persist_notification(context, data: dict):
    recipients = notification_recipients(context, data)
    silent_types = {"DICE_ROLL", "TEMPLATE_UPDATE", "CHARACTER_SHEET_UPDATE"}
    tipo = data.get("tipo")

    for username in recipients:
        notification_id = context.db.notifications.create(username, data)
        print(f"[NOTIFICATIONS] Nueva para {username}: {notification_id}")
        if tipo in silent_types:
            continue
        tokens = context.db.push_tokens.get_by_username(username)
        await asyncio.to_thread(send_pending_notification, tokens)


async def ws_sender_loop(context):
    while True:
        data = await context.ws_queue.get()

        print(f"[WS] Evento recibido de EVA: {data}")

        await persist_notification(context, data)
        await broadcast(data)


# 🚀 ENTRYPOINT DEL SERVER
async def start_ws_server(context):
    print(f"[WS] Arrancando servidor en ws://{context.ws_host}:{context.ws_port}")

    async with websockets.serve(
        lambda websocket: handler(websocket, context.incoming_queue),
        context.ws_host,
        context.ws_port
    ):
        print("[WS] Servidor listo")
        await ws_sender_loop(context)
