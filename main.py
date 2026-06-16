import asyncio
import signal
import socket

from src.app_context import close_app_context, create_app_context, set_app_context
from src.eva import start_eva
from src.horus_server import start_horus_server
from src.services.app_config import AppConfig
from src.web_server import start_web_server


def port_available(host: str, port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.bind((host, port))
    except OSError:
        return False

    return True


def check_ports_available():
    config = AppConfig()
    server = config.data["server"]
    host = server["host"]
    eva_port = server["evaPort"]
    client_port = server["clientPort"]
    checks = [
        ("EVA/configuración/WebSocket", host, eva_port),
        ("Cliente", host, client_port),
    ]
    blocked = [
        (label, checked_host, checked_port)
        for label, checked_host, checked_port in checks
        if not port_available(checked_host, checked_port)
    ]

    if not blocked:
        return

    lines = [
        "[EVA] No arranco nada porque hay puertos ocupados:",
        *[
            f" - {label}: {checked_host}:{checked_port}"
            for label, checked_host, checked_port in blocked
        ],
        "",
        "Cierra el proceso que usa ese puerto o cambia puertos, por ejemplo:",
        "  EVA_PORT=8100 EVA_CLIENT_PORT=8101 python3 main.py",
    ]
    raise SystemExit("\n".join(lines))


async def main():
    check_ports_available()
    context = create_app_context()
    set_app_context(context)
    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()

    for signum in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(signum, stop_event.set)
        except (NotImplementedError, RuntimeError):
            pass

    tasks = [
        asyncio.create_task(start_web_server(context), name="eva-web"),
        asyncio.create_task(start_horus_server(context), name="horus-web"),
        asyncio.create_task(start_eva(context), name="eva-core"),
    ]

    try:
        await stop_event.wait()
    finally:
        for task in tasks:
            task.cancel()

        await asyncio.gather(*tasks, return_exceptions=True)
        await close_app_context(context)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nCerrando EVA.")
