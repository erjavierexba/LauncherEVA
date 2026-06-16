import audioop
import json
import queue
import re
import time
import unicodedata
import subprocess
import asyncio
import os
import sounddevice as sd
from src.commands.registry import crear_comando
from src.services.vosk_model import ensure_vosk_model_in_background, vosk_download_error, vosk_model_dir
from vosk import Model, KaldiRecognizer, SetLogLevel

MODEL_PATH = str(vosk_model_dir())
SAMPLE_RATE = 16000
AUDIO_BLOCK_MS = int(os.getenv("EVA_AUDIO_BLOCK_MS", "100"))
AUDIO_BLOCK_SIZE = max(400, int(SAMPLE_RATE * AUDIO_BLOCK_MS / 1000))
WAKE_WORD = "eva"

COMMAND_TIMEOUT_SECONDS = 8

MIN_AVG_RMS = int(os.getenv("EVA_MIN_AVG_RMS", "180"))
MIN_AVG_CONF = float(os.getenv("EVA_MIN_AVG_CONF", "0.62"))
MIN_WAKE_CONF = float(os.getenv("EVA_MIN_WAKE_CONF", "0.65"))
FAST_FINALIZE_ENABLED = os.getenv("EVA_FAST_FINALIZE", "1") != "0"
FAST_FINALIZE_SILENCE_SECONDS = float(os.getenv("EVA_FAST_FINALIZE_SILENCE_SECONDS", "0.55"))
FAST_FINALIZE_MIN_UTTERANCE_SECONDS = float(os.getenv("EVA_FAST_FINALIZE_MIN_UTTERANCE_SECONDS", "0.35"))
SILENCE_RMS = int(os.getenv("EVA_SILENCE_RMS", "150"))
SILENCE_WINDOW_SECONDS = float(os.getenv("EVA_SILENCE_WINDOW_SECONDS", "0.35"))
ws_loop = None
SetLogLevel(-1)

q = queue.Queue()
current_rms_values = []
silence_rms_values = []

last_eva_time = 0
comando_activo = None
is_speaking = False
muted_until = 0


NUMS = {
    "cero": "0",
    "uno": "1",
    "una": "1",
    "dos": "2",
    "tres": "3",
    "cuatro": "4",
    "cinco": "5",
    "seis": "6",
    "siete": "7",
    "ocho": "8",
    "nueve": "9",
    "diez": "10",
}


def vaciar_cola_audio():
    while not q.empty():
        try:
            q.get_nowait()
        except queue.Empty:
            break

def decir(texto: str):
    global is_speaking, muted_until

    is_speaking = True
    print(f"EVA: {texto}")

    subprocess.run([
        "espeak-ng",
        "-v", "es+f4",
        "-s", "170",
        "-p", "70",
        "-a", "110",  # antes 160
        texto
    ])

    time.sleep(0.15)
    vaciar_cola_audio()

    muted_until = time.perf_counter() + 0.35
    is_speaking = False


def callback(indata, frames, time_info, status):
    if status:
        print(status)

    data = bytes(indata)

    try:
        rms = audioop.rms(data, 2)
    except Exception:
        rms = 0

    q.put((data, rms))


def quitar_tildes(texto: str) -> str:
    return "".join(
        c
        for c in unicodedata.normalize("NFD", texto)
        if unicodedata.category(c) != "Mn"
    )


def normalizar_texto(texto: str) -> str:
    texto = quitar_tildes(texto.lower().strip())

    for palabra, numero in NUMS.items():
        texto = re.sub(rf"\b{palabra}\b", numero, texto)

    texto = texto.replace(" punto ", ".")
    texto = texto.replace(" barra ", "/")
    texto = texto.replace(" guion bajo ", "_")
    texto = texto.replace(" guion ", "-")

    texto = re.sub(r"\s+", " ", texto)

    return texto.strip()


def limpiar_objetivo(objetivo: str) -> str:
    objetivo = normalizar_texto(objetivo)

    objetivo = re.sub(
        r"^(?:sobre|acerca de|de|del|de la|de los|de las)\s+",
        "",
        objetivo,
    )

    objetivo = re.sub(
        r"^(?:el|la|los|las|un|una|unos|unas)\s+",
        "",
        objetivo,
    )

    objetivo = objetivo.replace(" . ", ".")
    objetivo = objetivo.replace(" / ", "/")

    return objetivo.strip()


def media_confianza(result: dict) -> float:
    words = result.get("result", [])

    if not words:
        return 1.0

    confs = [w.get("conf", 0) for w in words]
    return sum(confs) / len(confs)


def confianza_palabra(result: dict, palabra: str) -> float:
    palabra = normalizar_texto(palabra)

    for w in result.get("result", []):
        if normalizar_texto(w.get("word", "")) == palabra:
            return w.get("conf", 0)

    return 0


def detectar_comando(texto: str):
    texto = normalizar_texto(texto)

    patrones = [
        ("CONSULTA", r"^(?:consulta|consultame|busca|dime sobre)\s+(.+)$"),
        ("COUNTDOWN", r"^(?:cuenta atras|temporizador|timer|countdown)\s+(.+)$"),
        ("EJECUTA", r"^(?:ejecuta|activa|lanza)\s+(.+)$"),
        ("MUESTRA", r"^(?:muestra|manda|envia|ensena|foto|imagen|muestra foto|manda foto|envia foto)\s+(.+)$"),

        (
            "MUSICA_CONTROL",
            r"^(?:sube el volumen|sube volumen|subele volumen|sube la musica|sube musica|"
            r"baja el volumen|baja volumen|bajale volumen|baja la musica|baja musica|"
            r"volume up|volume down|subir volumen|bajar volumen|volumen arriba|volumen abajo|"
            r"para la musica|para musica|deten la musica|deten musica|stop musica|apaga la musica)$"
        ),

        ("MUSICA", r"^(?:ponme la cancion de|pon la cancion de|pon musica|pone musica|musica|reproduce|pon)\s+(.+)$"),

        ("BROMA", r"\b(?:hola|guapa|poderio|pedro|duro|como diria cristian|como diria christian|limon|limón)\b"),
    ]

    for tipo, patron in patrones:
        match = re.search(patron, texto)

        if match:
            objetivo_raw = match.group(1) if match.groups() else match.group(0)
            objetivo = limpiar_objetivo(objetivo_raw)

            if not objetivo:
                return None

            return {
                "tipo": tipo,
                "objetivo": objetivo,
                "texto_normalizado": texto,
            }

    return None

def imprimir_rechazo(motivo: str, texto: str = ""):
    print("---- RECHAZADO ----")
    print(f"Motivo: {motivo}")

    if texto:
        print(f"Texto: {texto}")

    print("-------------------\n")


def imprimir_log_activacion(texto_detectado: str, comando: str | None = None):
    print("================================")
    print(f"WAKE WORD DETECTADA: {WAKE_WORD}")
    print(f"Texto detectado: {texto_detectado}")

    if comando:
        print(f"Comando bruto: {comando}")

    print("================================\n")


def imprimir_log_comando(info, latencia: float | None = None):
    print("================================")
    print("COMANDO DETECTADO")
    print(f"Tipo: {info['tipo']}")
    print(f"Objetivo: {info['objetivo']}")
    print(f"Texto normalizado: {info['texto_normalizado']}")

    if latencia is not None:
        print(f"Tiempo desde activación: {latencia:.2f}s")

    print("================================\n")


def calcular_media_rms(valores: list[int]) -> float:
    return sum(valores) / len(valores) if valores else 0


def ventana_rms_silencio() -> int:
    muestras = max(1, int(SILENCE_WINDOW_SECONDS * 1000 / AUDIO_BLOCK_MS))
    return muestras


async def ejecutar_info_comando(info, context):
    global comando_activo, last_eva_time

    imprimir_log_comando(info)

    comando = crear_comando(info)

    if comando:
        resultado = comando.iniciar(decir)

        if resultado:
            print("RESULTADO COMANDO:")
            print(json.dumps(resultado, ensure_ascii=False, indent=2))

            # Solo mandamos al WS acciones que interesan a jugadores.
            if resultado.get("tipo") not in ("ERROR", "MUSICA", "MUSICA_CONTROL"):
                await context.ws_queue.put(resultado)
            comando_activo = None
            last_eva_time = 0
            return

        if getattr(comando, "conversacional", False):
            comando_activo = comando
            last_eva_time = time.perf_counter()
            return

        comando_activo = None
        last_eva_time = 0
        return

    last_eva_time = 0

def es_cancelar(texto: str) -> bool:
    texto = normalizar_texto(texto)

    patrones = [
        "cancelar",
        "cancelar comando",
        "cancela",
        "salir",
        "abortar"
    ]

    return any(p in texto for p in patrones)

async def check_consulta(data, context):
    return True


async def procesar_resultado_voz(result: dict, avg_rms: float, context):
    global comando_activo, last_eva_time

    text = result.get("text", "").strip().lower()

    if not text:
        return

    now = time.perf_counter()
    text_normalizado = normalizar_texto(text)
    palabras = text_normalizado.split()

    avg_conf = media_confianza(result)

    if avg_rms < MIN_AVG_RMS:
        imprimir_rechazo(
            f"volumen bajo / posible ruido RMS={avg_rms:.0f}",
            text_normalizado,
        )
        return

    if avg_conf < MIN_AVG_CONF:
        imprimir_rechazo(
            f"confianza baja CONF={avg_conf:.2f}",
            text_normalizado,
        )
        return

    if comando_activo:

        # Cancelación global mientras un comando conversacional está abierto.
        if es_cancelar(text_normalizado):
            decir("Comando cancelado.")
            comando_activo = None
            last_eva_time = 0
            return

        print(f"[DEBUG ESCUCHADO EN COMANDO]: {text_normalizado} | RMS={avg_rms:.0f} | CONF={avg_conf:.2f}")

        if now - last_eva_time > COMMAND_TIMEOUT_SECONDS:
            decir("Tiempo agotado. Cancelo el comando.")
            comando_activo = None
            last_eva_time = 0
            return

        resultado = comando_activo.procesar(text_normalizado, decir)
        last_eva_time = time.perf_counter()

        if resultado:
            print("RESULTADO COMANDO:")
            print(json.dumps(resultado, ensure_ascii=False, indent=2))

            if resultado.get("tipo") != "ERROR":
                await context.ws_queue.put(resultado)

            comando_activo = None
            last_eva_time = 0

        return

    if WAKE_WORD in palabras:
        wake_conf = confianza_palabra(result, WAKE_WORD)

        if wake_conf < MIN_WAKE_CONF:
            imprimir_rechazo(
                f"wake word poco fiable CONF={wake_conf:.2f}",
                text_normalizado,
            )
            return

        last_eva_time = now
        comando_texto = text_normalizado.split(WAKE_WORD, 1)[1].strip()

        imprimir_log_activacion(text, comando_texto if comando_texto else None)

        if comando_texto:
            info = detectar_comando(comando_texto)

            if info is None:
                decir("No te entiendo")
                imprimir_rechazo("comando no reconocido", comando_texto)
                last_eva_time = 0
                return

            await ejecutar_info_comando(info, context)
        else:
            decir("Te escucho.")

    elif last_eva_time and now - last_eva_time < COMMAND_TIMEOUT_SECONDS:
        info = detectar_comando(text_normalizado)

        if info is None:
            imprimir_rechazo(
                "comando posterior a Eva no reconocido",
                text_normalizado,
            )
            last_eva_time = 0
            return

        await ejecutar_info_comando(info, context)

    elif last_eva_time and now - last_eva_time >= COMMAND_TIMEOUT_SECONDS:
        last_eva_time = 0


async def start_eva(context):
    global comando_activo, last_eva_time

    print("[MEDIA] Base URL:", context.media_catalog.base_url)
    model_path = vosk_model_dir()
    if not model_path.exists():
        print(f"[VOSK] Modelo no encontrado en {model_path}. Inicio descarga en segundo plano.")
        ensure_vosk_model_in_background(print)

    while not model_path.exists():
        error = vosk_download_error()
        if error:
            print(f"[VOSK] Aun no disponible: {error}")
            ensure_vosk_model_in_background(print)
        await asyncio.sleep(1)

    print("Cargando modelo español...")
    model = Model(MODEL_PATH)
    rec = KaldiRecognizer(model, SAMPLE_RATE)
    rec.SetWords(True)

    print("Escuchando.")
    print(f"Audio: bloques de {AUDIO_BLOCK_MS} ms ({AUDIO_BLOCK_SIZE} frames)")
    if FAST_FINALIZE_ENABLED:
        print(
            "Corte rápido: "
            f"silencio {FAST_FINALIZE_SILENCE_SECONDS:.2f}s, "
            f"RMS silencio <= {SILENCE_RMS}"
        )
    print("Ejemplos:")
    print(" - Eva consulta sobre el ritual")
    print(" - Eva ejecuta protocolo alfa")
    print(" - Eva muestra pantano punto png")
    print(" - Eva pon música combate")
    print("Pulsa CTRL+C para salir.\n")

    with sd.RawInputStream(
        samplerate=SAMPLE_RATE,
        blocksize=AUDIO_BLOCK_SIZE,
        dtype="int16",
        channels=1,
        callback=callback,
    ):
        last_partial_text = ""
        last_partial_change = time.perf_counter()
        utterance_started_at = None

        while True:
            while not context.incoming_queue.empty():
                data = await context.incoming_queue.get()
                if not await check_consulta(data, context):
                    continue
            await asyncio.sleep(0)

            try:
                data, rms = q.get(timeout=0.2)
            except queue.Empty:
                continue

            if is_speaking:
                continue

            if time.perf_counter() < muted_until:
                continue

            current_rms_values.append(rms)
            silence_rms_values.append(rms)
            max_silence_samples = ventana_rms_silencio()
            if len(silence_rms_values) > max_silence_samples:
                del silence_rms_values[:-max_silence_samples]

            if not rec.AcceptWaveform(data):
                if not FAST_FINALIZE_ENABLED:
                    continue

                partial = json.loads(rec.PartialResult()).get("partial", "").strip()
                now = time.perf_counter()

                if partial and partial != last_partial_text:
                    last_partial_text = partial
                    last_partial_change = now
                    utterance_started_at = utterance_started_at or now
                    continue

                if not partial or utterance_started_at is None:
                    if rms <= SILENCE_RMS and not last_partial_text:
                        current_rms_values.clear()
                    continue

                recent_rms = calcular_media_rms(silence_rms_values)
                partial_quiet_for = now - last_partial_change
                utterance_age = now - utterance_started_at

                if (
                    partial_quiet_for < FAST_FINALIZE_SILENCE_SECONDS
                    or utterance_age < FAST_FINALIZE_MIN_UTTERANCE_SECONDS
                    or recent_rms > SILENCE_RMS
                ):
                    continue

                result = json.loads(rec.FinalResult())
                rec.Reset()
                last_partial_text = ""
                utterance_started_at = None
                last_partial_change = now

                avg_rms = calcular_media_rms(current_rms_values)
                current_rms_values.clear()
                silence_rms_values.clear()

                await procesar_resultado_voz(result, avg_rms, context)
                continue

            result = json.loads(rec.Result())
            last_partial_text = ""
            utterance_started_at = None
            last_partial_change = time.perf_counter()

            avg_rms = calcular_media_rms(current_rms_values)
            current_rms_values.clear()
            silence_rms_values.clear()

            await procesar_resultado_voz(result, avg_rms, context)
