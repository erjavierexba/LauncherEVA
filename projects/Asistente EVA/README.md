# Asistente EVA

EVA es una asistente local configurable para partidas de rol, pensada para ejecutarse en un ordenador principal y comunicarse con otros dispositivos mediante WebSocket/HTTP.

Permite escuchar comandos por voz, enviar recursos a móviles conectados, reproducir música, lanzar temporizadores y gestionar usuarios/archivos desde un panel web.

---

## Requisitos

Sistema recomendado:

- Ubuntu / Linux
- Python 3.12 o superior
- Micrófono funcional
- Conexión local entre el PC y los dispositivos móviles
- Puertos abiertos para WebSocket y servidor HTTP

Dependencias del sistema recomendadas:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip portaudio19-dev espeak-ng
```

---

## Instalación

Clona o descarga el proyecto y entra en la carpeta principal:

```bash
cd Asistente-EVA
```

Crea un entorno virtual:

```bash
python -m venv .venv
```

Activa el entorno virtual:

```bash
source .venv/bin/activate
```

Instala las dependencias de Python:

```bash
pip install -r requirements.txt
```

---

## Puertos necesarios

EVA utiliza puertos locales para comunicarse con otros dispositivos.

Abre los puertos necesarios en el firewall:

```bash
sudo ufw allow 8765/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 8081/tcp
```

Comprueba el estado del firewall:

```bash
sudo ufw status
```

Puertos usados:

| Puerto | Uso |
| --- | --- |
| `8765` | WebSocket |
| `8080` | Servidor HTTP / archivos multimedia |
| `8081` | Horus PWA para jugadores |

La app cliente debe configurarse con la dirección HTTP de EVA, por ejemplo:

```txt
192.168.1.42:8080
```

Horus se abre desde el navegador del jugador en el puerto PWA:

```txt
192.168.1.42:8081
```

Para instalarla como PWA, el navegador puede exigir HTTPS salvo en `localhost`.

Para que Horus registre notificaciones web con Firebase, el launcher debe escribir la configuración
en `config/eva.config.json -> firebase.web`:

```json
{
  "firebase": {
    "serviceAccountPath": "config/firebase-service-account.json",
    "web": {
      "vapidPublicKey": "CLAVE_VAPID_PUBLICA",
      "vapidPrivateKey": "CLAVE_VAPID_PRIVADA",
      "firebaseConfig": {
        "apiKey": "...",
        "projectId": "...",
        "messagingSenderId": "...",
        "appId": "..."
      }
    }
  }
}
```

---

## Notificaciones FCM para Android

Para que la APK release instalada localmente reciba avisos con la pantalla
bloqueada, EVA usa Firebase Cloud Messaging.

En el launcher configura el archivo de cuenta de servicio de Firebase. EVA lo
lee desde:

```txt
config/eva.config.json -> firebase.serviceAccountPath
```

También puedes apuntar a otra ruta con variable de entorno:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/ruta/firebase-service-account.json"
```

Ese archivo se descarga desde Firebase Console:

```txt
Project settings -> Service accounts -> Generate new private key
```

La app Android necesita su propio archivo distinto:

```txt
android/app/google-services.json
```

Ese archivo debe corresponder al paquete:

```txt
com.tuorganizacion.eva
```

Una vez la app haya iniciado sesión y enviado su token a EVA, puedes probar el
push contra un usuario:

```bash
curl -X POST http://localhost:8080/api/push/test/Director
```

---

## Configuración pública

El tema visual y los usuarios iniciales viven en:

```txt
config/eva.config.json
```

Ejemplo mínimo:

```json
{
  "assistant": {
    "name": "EVA",
    "wakeWord": "eva"
  },
  "theme": {
    "title": "Panel de Control EVA",
    "background": "#0d0f12",
    "surface": "#1a1f27",
    "surfaceAlt": "#111419",
    "text": "#ededed",
    "muted": "#9fa7b3",
    "accent": "#c9a24a",
    "primary": "#66ccff",
    "danger": "#c65353",
    "radius": "8px"
  },
  "users": [
    {
      "name": "Director",
      "aliases": ["director", "master", "narrador"]
    }
  ]
}
```

---

## Modelo de voz Vosk

EVA necesita el modelo español de Vosk:

```txt
vosk-model-es-0.42
```

Debe estar colocado en la raíz del proyecto o en la ruta configurada en EVA:

```python
MODEL_PATH = "vosk-model-es-0.42"
```

Si tienes un script de instalación del modelo, ejecútalo desde la carpeta principal:

```bash
./install_vosk_eva.sh
```

## Ajuste de escucha

EVA escucha el micrófono en bloques cortos y fuerza el cierre de frase cuando
detecta que el texto parcial está estable y el volumen ha caído a silencio.
Si la respuesta tarda demasiado en cortar, prueba:

```bash
export EVA_FAST_FINALIZE_SILENCE_SECONDS=0.40
export EVA_SILENCE_RMS=180
python main.py
```

Si corta frases demasiado pronto, usa valores más conservadores:

```bash
export EVA_FAST_FINALIZE_SILENCE_SECONDS=0.75
export EVA_SILENCE_RMS=120
python main.py
```

Variables útiles:

| Variable | Valor por defecto | Uso |
| --- | --- | --- |
| `EVA_AUDIO_BLOCK_MS` | `100` | Tamaño de cada bloque de audio. Menor valor reacciona antes. |
| `EVA_FAST_FINALIZE` | `1` | Activa o desactiva el corte rápido (`0` para desactivar). |
| `EVA_FAST_FINALIZE_SILENCE_SECONDS` | `0.55` | Tiempo de silencio antes de cerrar la frase. |
| `EVA_SILENCE_RMS` | `150` | Volumen máximo considerado silencio. |
| `EVA_MIN_AVG_RMS` | `180` | Volumen medio mínimo para aceptar una frase. |
| `EVA_MIN_AVG_CONF` | `0.62` | Confianza media mínima del reconocimiento. |
| `EVA_MIN_WAKE_CONF` | `0.65` | Confianza mínima para aceptar la palabra `Eva`. |

---

## Ejecutar EVA

Con el entorno virtual activado:

```bash
python main.py
```

Si todo está correcto, EVA cargará el modelo de voz y empezará a escuchar comandos.

---

## Comandos de ejemplo

Algunos comandos reconocidos:

```txt
Eva muestra pantano punto png
Eva manda audio alarma a todos
Eva pon música combate
Eva sube el volumen
Eva baja la música
Eva para la música
Eva temporizador para todos 10 segundos
Eva cuenta atrás para Director 1 minuto
```

---

## Estructura básica

```txt
Asistente-EVA/
├── main.py
├── requirements.txt
├── vosk-model-es-0.42/
├── src/
│   ├── eva.py
│   ├── commands/
│   └── services/
└── assets/
```

---

## Problemas comunes

### No se escucha la voz de EVA

Instala `espeak-ng`:

```bash
sudo apt install -y espeak-ng
```

Prueba manual:

```bash
espeak-ng -v es+f4 "Eva funcionando"
```

---

### Error con `sounddevice` o micrófono

Asegúrate de tener instalado PortAudio:

```bash
sudo apt install -y portaudio19-dev
```

Después reinstala dependencias dentro del entorno virtual:

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

---

### Los móviles no conectan

Comprueba que:

1. El PC y los móviles están en la misma red.
2. Los puertos `8765` y `8080` están abiertos.
3. La IP usada por EVA es accesible desde el móvil.
4. No hay VPN o firewall bloqueando la conexión.

Puedes consultar la IP local con:

```bash
ip a
```

---

## Arranque rápido

```bash
sudo ufw allow 8765/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 8081/tcp

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python main.py
```

---

## Notas

EVA está pensada como herramienta de apoyo para partidas privadas de rol.

El ordenador principal actúa como servidor local y los móviles se conectan como clientes.
