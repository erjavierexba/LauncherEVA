from __future__ import annotations

import sys
import threading
import webbrowser
import os
import runpy
from pathlib import Path

from launcher_eva.web_app import create_server, shutdown_server


def run_eva_child() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("Falta ruta de EVA.")

    eva_path = Path(sys.argv[2]).resolve()
    os.chdir(eva_path)
    sys.path.insert(0, str(eva_path))
    runpy.run_path(str(eva_path / "main.py"), run_name="__main__")


def main() -> None:
    if len(sys.argv) >= 2 and sys.argv[1] == "--run-eva":
        run_eva_child()
        return

    server, url = create_server()

    try:
        from PySide6.QtCore import QUrl
        from PySide6.QtWebEngineWidgets import QWebEngineView
        from PySide6.QtWidgets import QApplication, QMainWindow
    except ImportError:
        webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            shutdown_server(server)
        return

    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    app = QApplication(sys.argv)
    window = QMainWindow()
    window.setWindowTitle("Launcher EVA")
    view = QWebEngineView()
    view.setUrl(QUrl(url))
    window.setCentralWidget(view)
    window.showMaximized()

    app.aboutToQuit.connect(lambda: shutdown_server(server))
    raise SystemExit(app.exec())


if __name__ == "__main__":
    main()
