import asyncio
import json

from aiohttp import web, WSMsgType

CLIENTS = set()


async def websocket_handler(request):
    websocket = web.WebSocketResponse()
    await websocket.prepare(request)

    print("[WS] Cliente conectado")
    CLIENTS.add(websocket)
    incoming_queue = request.app["context"].incoming_queue

    try:
        async for message in websocket:
            if message.type != WSMsgType.TEXT:
                continue

            print(f"[WS] Recibido: {message.data}")

            try:
                data = json.loads(message.data)
            except json.JSONDecodeError:
                print("[WS] JSON inválido")
                continue

            await incoming_queue.put(data)

    finally:
        CLIENTS.discard(websocket)
        print("[WS] Cliente desconectado")

    return websocket


async def broadcast(data: dict):
    if not CLIENTS:
        print("[WS] Sin clientes conectados")
        return

    message = json.dumps(data, ensure_ascii=False)

    disconnected = []

    for client in CLIENTS:
        try:
            await client.send_str(message)
        except ConnectionResetError:
            disconnected.append(client)

    for client in disconnected:
        CLIENTS.discard(client)

    print(f"[WS] Enviado: {message}")


async def ws_sender_loop(context):
    while True:
        data = await context.ws_queue.get()

        print(f"[WS] Evento recibido de EVA: {data}")

        await broadcast(data)


async def start_ws_loop(app):
    context = app["context"]
    print(f"[WS] Eventos en ws://localhost:{context.ws_port}/ws")
    app["ws_sender_task"] = asyncio.create_task(ws_sender_loop(context))


async def stop_ws_loop(app):
    task = app.get("ws_sender_task")
    if task:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    for client in set(CLIENTS):
        await client.close()
    CLIENTS.clear()
