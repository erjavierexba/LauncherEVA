from pathlib import Path
import pygame

VOLUME_INCREMENT = 0.15


class MusicService:
    def __init__(self):
        pygame.mixer.init()
        self.volume = 0.55
        self.current_path = None
        self.current_label = None
        self.current_context = None
        self.current_number = None
        self.paused = False
        pygame.mixer.music.set_volume(self.volume)

    def play(self, path: str, label: str | None = None, context: str | None = None, number: int | None = None):
        file_path = Path(path)

        if not file_path.exists():
            return {
                "ok": False,
                "mensaje": f"No encuentro el archivo de música: {path}",
            }

        try:
            pygame.mixer.music.load(str(file_path))
            pygame.mixer.music.play(-1)
            self.current_path = str(file_path)
            self.current_label = label or file_path.stem
            self.current_context = context
            self.current_number = number
            self.paused = False

            return {
                "ok": True,
                "mensaje": f"Reproduciendo {self.current_label}.",
                "estado": self.status(),
            }
        except Exception as e:
            return {
                "ok": False,
                "mensaje": f"No he podido reproducir la música: {e}",
            }

    def pause(self):
        if not self.current_path:
            return {
                "ok": False,
                "mensaje": "No hay música sonando.",
                "estado": self.status(),
            }

        pygame.mixer.music.pause()
        self.paused = True

        return {
            "ok": True,
            "mensaje": "Música pausada.",
            "estado": self.status(),
        }

    def resume(self):
        if not self.current_path:
            return {
                "ok": False,
                "mensaje": "No hay música cargada.",
                "estado": self.status(),
            }

        pygame.mixer.music.unpause()
        self.paused = False

        return {
            "ok": True,
            "mensaje": f"Reproduciendo {self.current_label}.",
            "estado": self.status(),
        }

    def restart(self):
        if not self.current_path:
            return {
                "ok": False,
                "mensaje": "No hay música cargada.",
                "estado": self.status(),
            }

        return self.play(
            self.current_path,
            label=self.current_label,
            context=self.current_context,
            number=self.current_number,
        )

    def stop(self):
        pygame.mixer.music.stop()
        self.current_path = None
        self.current_label = None
        self.current_context = None
        self.current_number = None
        self.paused = False

        return {
            "ok": True,
            "mensaje": "Música detenida.",
            "estado": self.status(),
        }

    def volume_up(self):
        self.volume = min(1.0, self.volume + VOLUME_INCREMENT)
        pygame.mixer.music.set_volume(self.volume)

        return {
            "ok": True,
            "mensaje": f"Volumen al {int(self.volume * 100)} por ciento.",
            "estado": self.status(),
        }

    def volume_down(self):
        self.volume = max(0.0, self.volume - VOLUME_INCREMENT)
        pygame.mixer.music.set_volume(self.volume)

        return {
            "ok": True,
            "mensaje": f"Volumen al {int(self.volume * 100)} por ciento.",
            "estado": self.status(),
        }

    def status(self):
        return {
            "current": {
                "path": self.current_path,
                "label": self.current_label,
                "contexto": self.current_context,
                "numero": self.current_number,
            } if self.current_path else None,
            "playing": bool(self.current_path and not self.paused and pygame.mixer.music.get_busy()),
            "paused": self.paused,
            "volume": self.volume,
        }
