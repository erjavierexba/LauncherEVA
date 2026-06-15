import socket


def get_lan_ip() -> str:
    """
    Devuelve la IP LAN principal del PC.
    No hace una conexión real, solo fuerza al sistema a elegir interfaz.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def get_base_url(port: int = 8080) -> str:
    return f"http://{get_lan_ip()}:{port}"