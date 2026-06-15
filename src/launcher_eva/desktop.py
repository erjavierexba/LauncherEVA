from __future__ import annotations

import os
import platform
import runpy
import shutil
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path


CHECK_INTERVAL_MS = 1200
STARTUP_TIMEOUT_SECONDS = 45


def app_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[2]


def run_eva_child() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("Falta ruta de EVA.")

    eva_path = Path(sys.argv[2]).resolve()
    os.chdir(eva_path)
    sys.path.insert(0, str(eva_path))
    runpy.run_path(str(eva_path / "main.py"), run_name="__main__")


def load_server_settings(root: Path) -> dict:
    os.chdir(root)
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from src.services.app_config import AppConfig

    server = AppConfig().data["server"]
    return {
        "host": str(server.get("host", "0.0.0.0")),
        "eva_port": int(server.get("evaPort", 8000)),
        "client_port": int(server.get("clientPort", 8080)),
    }


def config_path(root: Path) -> Path:
    return root / "config" / "eva.config.json"


def config_url(settings: dict) -> str:
    return f"http://127.0.0.1:{settings['eva_port']}/config"


def client_url(settings: dict) -> str:
    return f"http://127.0.0.1:{settings['client_port']}/"


def start_eva_process(root: Path) -> subprocess.Popen:
    if getattr(sys, "frozen", False):
        command = [str(Path(sys.executable)), "--run-eva", str(root)]
    else:
        command = [str(Path(sys.executable)), str(Path(__file__).resolve()), "--run-eva", str(root)]

    env = os.environ.copy()
    env["PYTHONPATH"] = os.pathsep.join([str(root), str(root / "src"), env.get("PYTHONPATH", "")])
    return subprocess.Popen(command, cwd=str(root), env=env)


def stop_eva_process(process: subprocess.Popen | None) -> None:
    if process is None or process.poll() is not None:
        return

    process.terminate()
    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=4)


def wait_for_url(url: str, timeout: int = STARTUP_TIMEOUT_SECONDS) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.2) as response:
                if response.status < 500:
                    return True
        except Exception:
            time.sleep(0.35)
    return False


def is_lan_host(host: str) -> bool:
    return host in {"0.0.0.0", "::", ""} or not host.startswith("127.") and host != "localhost"


def firewall_advice(settings: dict) -> str:
    if not is_lan_host(settings["host"]):
        return ""

    ports = sorted({settings["eva_port"], settings["client_port"]})
    system = platform.system().lower()

    if system == "linux":
        if shutil.which("ufw"):
            try:
                status = subprocess.run(
                    ["ufw", "status"],
                    text=True,
                    capture_output=True,
                    timeout=2,
                    check=False,
                ).stdout.lower()
            except Exception:
                status = ""
            if "status: active" in status:
                missing = [port for port in ports if f"{port}/tcp" not in status and f"{port} " not in status]
                if missing:
                    commands = "\n".join(f"sudo ufw allow {port}/tcp" for port in missing)
                    return (
                        "El firewall UFW está activo. Para que los jugadores entren desde otros dispositivos, "
                        "permite los puertos de EVA:\n\n"
                        f"{commands}"
                    )
        if shutil.which("firewall-cmd"):
            commands = "\n".join(
                f"sudo firewall-cmd --permanent --add-port={port}/tcp\nsudo firewall-cmd --reload"
                for port in ports
            )
            return (
                "Si firewalld está activo y los jugadores no conectan, permite estos puertos:\n\n"
                f"{commands}"
            )
        return (
            "No puedo confirmar el firewall de Linux. Si los jugadores no conectan desde otro dispositivo, "
            f"permite TCP en los puertos {', '.join(str(port) for port in ports)}."
        )

    if system == "windows":
        commands = "\n".join(
            'netsh advfirewall firewall add rule name="Launcher EVA {port}" dir=in action=allow protocol=TCP localport={port}'.format(port=port)
            for port in ports
        )
        return (
            "En Windows puede hacer falta permitir EVA en el firewall. Ejecuta como administrador si los jugadores no conectan:\n\n"
            f"{commands}"
        )

    return ""


class EvaDesktopController:
    def __init__(self, root: Path):
        self.root = root
        self.settings = load_server_settings(root)
        self.config_mtime = self.current_config_mtime()
        self.process: subprocess.Popen | None = None
        self.view = None

    def current_config_mtime(self) -> float:
        try:
            return config_path(self.root).stat().st_mtime
        except OSError:
            return 0.0

    def start(self) -> None:
        self.process = start_eva_process(self.root)

    def stop(self) -> None:
        stop_eva_process(self.process)
        self.process = None

    def restart_if_config_changed(self) -> None:
        mtime = self.current_config_mtime()
        if mtime <= self.config_mtime:
            return

        next_settings = load_server_settings(self.root)
        ports_changed = (
            next_settings["eva_port"] != self.settings["eva_port"]
            or next_settings["client_port"] != self.settings["client_port"]
            or next_settings["host"] != self.settings["host"]
        )
        self.config_mtime = mtime
        self.settings = next_settings

        if ports_changed:
            self.stop()
            self.start()
            wait_for_url(config_url(self.settings))

        if self.view is not None:
            from PySide6.QtCore import QUrl

            self.view.setUrl(QUrl(config_url(self.settings)))


def main() -> None:
    if len(sys.argv) >= 2 and sys.argv[1] == "--run-eva":
        run_eva_child()
        return

    root = app_root()
    controller = EvaDesktopController(root)
    controller.start()

    try:
        from PySide6.QtCore import QTimer, QUrl
        from PySide6.QtWebEngineWidgets import QWebEngineView
        from PySide6.QtWidgets import QApplication, QMainWindow, QMessageBox
    except ImportError:
        url = config_url(controller.settings)
        wait_for_url(url)
        webbrowser.open(url)
        print(f"Configurador EVA: {url}")
        print(f"Cliente jugadores: {client_url(controller.settings)}")
        advice = firewall_advice(controller.settings)
        if advice:
            print(f"\n{advice}\n")
        try:
            controller.process.wait()
        except KeyboardInterrupt:
            pass
        finally:
            controller.stop()
        return

    app = QApplication(sys.argv)
    app.setApplicationName("Launcher EVA")

    window = QMainWindow()
    window.setWindowTitle("Launcher EVA")
    view = QWebEngineView()
    controller.view = view
    window.setCentralWidget(view)
    window.resize(1280, 820)
    window.show()

    wait_for_url(config_url(controller.settings))
    view.setUrl(QUrl(config_url(controller.settings)))

    advice = firewall_advice(controller.settings)
    if advice:
        QMessageBox.information(window, "Permisos de red", advice)

    timer = QTimer()
    timer.timeout.connect(controller.restart_if_config_changed)
    timer.start(CHECK_INTERVAL_MS)

    app.aboutToQuit.connect(controller.stop)
    raise SystemExit(app.exec())


if __name__ == "__main__":
    main()
