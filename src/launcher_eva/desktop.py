from __future__ import annotations

import ctypes.util
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

from src.services.app_paths import app_config_path, app_icon_path


CHECK_INTERVAL_MS = 1200
STARTUP_TIMEOUT_SECONDS = 45


def bundled_root() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parents[2]


def app_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return bundled_root()


def run_eva_child() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("Falta ruta de EVA.")

    eva_path = Path(sys.argv[2]).resolve()
    source_root = bundled_root()
    os.chdir(eva_path)
    for path in (source_root, source_root / "src", eva_path):
        string_path = str(path)
        if string_path not in sys.path:
            sys.path.insert(0, string_path)
    runpy.run_path(str(source_root / "main.py"), run_name="__main__")


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
    return app_config_path()


def config_url(settings: dict) -> str:
    return f"http://127.0.0.1:{settings['eva_port']}/config"


def client_url(settings: dict) -> str:
    return f"http://127.0.0.1:{settings['client_port']}/"


def loading_html(title: str) -> str:
    return f"""\
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>{title}</title>
  <style>
    :root {{
      color-scheme: dark;
      font-family: Inter, system-ui, sans-serif;
    }}
    body {{
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #17111f;
      color: #f1ecff;
    }}
    main {{
      display: grid;
      gap: 12px;
      justify-items: center;
      text-align: center;
    }}
    .spinner {{
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: 3px solid rgba(255, 255, 255, 0.15);
      border-top-color: #72d1d8;
      animation: spin 0.8s linear infinite;
    }}
    p {{
      margin: 0;
      color: #b4a7ca;
    }}
    @keyframes spin {{
      to {{ transform: rotate(360deg); }}
    }}
  </style>
</head>
<body>
  <main>
    <div class="spinner"></div>
    <strong>{title}</strong>
    <p>Cargando panel y servicios en segundo plano...</p>
  </main>
</body>
</html>
"""


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


def probe_url(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=0.25) as response:
            return response.status < 500
    except Exception:
        return False


def can_use_qt_desktop() -> tuple[bool, str]:
    system = platform.system().lower()
    if system == "linux" and ctypes.util.find_library("xcb-cursor") is None:
        return (
            False,
            "Falta libxcb-cursor0 para abrir la ventana local. Se usará el navegador.",
        )
    return True, ""


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
        self.queue_view_reload = None

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

        if callable(self.queue_view_reload):
            self.queue_view_reload()
        elif self.view is not None:
            from PySide6.QtCore import QUrl

            self.view.setUrl(QUrl(config_url(self.settings)))


def main() -> None:
    if len(sys.argv) >= 2 and sys.argv[1] == "--run-eva":
        run_eva_child()
        return

    root = app_root()
    controller = EvaDesktopController(root)
    controller.start()

    qt_ready, qt_reason = can_use_qt_desktop()
    try:
        from PySide6.QtCore import QTimer, QUrl
        from PySide6.QtGui import QDesktopServices
        from PySide6.QtWebEngineCore import QWebEnginePage
        from PySide6.QtWebEngineWidgets import QWebEngineView
        from PySide6.QtWidgets import QApplication, QMainWindow, QMessageBox
    except ImportError:
        qt_ready = False
        qt_reason = qt_reason or "No se ha podido cargar PySide6."

    if not qt_ready:
        url = config_url(controller.settings)
        wait_for_url(url)
        webbrowser.open(url)
        print(f"Configurador EVA: {url}")
        print(f"Cliente jugadores: {client_url(controller.settings)}")
        if qt_reason:
            print(qt_reason)
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
    icon_path = app_icon_path()
    if icon_path.exists():
        from PySide6.QtGui import QIcon

        app.setWindowIcon(QIcon(str(icon_path)))

    window = QMainWindow()
    window.setWindowTitle("Launcher EVA")
    if icon_path.exists():
        from PySide6.QtGui import QIcon

        window.setWindowIcon(QIcon(str(icon_path)))

    class EvaWebPage(QWebEnginePage):
        def __init__(self, parent=None, open_external_only: bool = False):
            super().__init__(parent)
            self.open_external_only = open_external_only

        def is_internal_url(self, url: QUrl) -> bool:
            target = QUrl(config_url(controller.settings))
            return (
                url.isRelative()
                or (
                    url.scheme() == target.scheme()
                    and url.host() == target.host()
                    and url.port() == target.port()
                )
            )

        def open_external_url(self, url: QUrl) -> None:
            if not url.isValid():
                return
            if not QDesktopServices.openUrl(url):
                webbrowser.open(url.toString())

        def acceptNavigationRequest(self, url, navigation_type, is_main_frame):
            if self.open_external_only:
                self.open_external_url(url)
                return False

            if navigation_type == QWebEnginePage.NavigationTypeLinkClicked and not self.is_internal_url(url):
                self.open_external_url(url)
                return False

            return super().acceptNavigationRequest(url, navigation_type, is_main_frame)

        def createWindow(self, _window_type):
            return EvaWebPage(self, open_external_only=True)

    view = QWebEngineView()
    page = EvaWebPage(view)
    view.setPage(page)
    controller.view = view
    window.setCentralWidget(view)
    window.resize(1280, 820)
    window.show()
    view.setHtml(loading_html("Cargando EVA"))

    pending_url = {"value": config_url(controller.settings)}
    retry_timer = QTimer()
    retry_timer.setInterval(450)

    def try_load_pending_url():
        target_url = pending_url["value"]
        if probe_url(target_url):
            retry_timer.stop()
            view.setUrl(QUrl(target_url))
            return

        view.setHtml(loading_html("Cargando EVA"))

    def queue_view_reload():
        pending_url["value"] = config_url(controller.settings)
        view.setHtml(loading_html("Cargando EVA"))
        if not retry_timer.isActive():
            retry_timer.start()

    retry_timer.timeout.connect(try_load_pending_url)
    queue_view_reload()

    advice = firewall_advice(controller.settings)
    if advice:
        QMessageBox.information(window, "Permisos de red", advice)

    timer = QTimer()
    timer.timeout.connect(controller.restart_if_config_changed)
    timer.start(CHECK_INTERVAL_MS)
    controller.queue_view_reload = queue_view_reload

    app.aboutToQuit.connect(controller.stop)
    raise SystemExit(app.exec())


if __name__ == "__main__":
    main()
