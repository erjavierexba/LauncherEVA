# Launcher EVA

Launcher EVA es ahora el proyecto combinado: incluye el configurador, EVA y la web cliente para jugadores.

## Ejecutar

Desde esta carpeta:

```bash
python3 main.py
```

Esto levanta:

| Puerto | Uso |
| --- | --- |
| `8000` | Panel EVA / configuración de partida / WebSocket |
| `8080` | Cliente móvil web |

Abre:

```txt
http://localhost:8000
http://localhost:8080
```

## Configurador

El configurador propio del launcher se arranca con:

```bash
PYTHONPATH=src python3 -m launcher_eva
```

Desde ahí puedes guardar rol, tema, jugadores, archivos, micro y puertos. El configurador escribe en `config/eva.config.json` dentro de este mismo proyecto.

## Puertos

Los puertos viven en:

```json
{
  "server": {
    "host": "0.0.0.0",
    "evaPort": 8000,
    "clientPort": 8080
  }
}
```

También pueden sobreescribirse al arrancar:

```bash
EVA_PORT=8001 EVA_CLIENT_PORT=8081 python3 main.py
```

## Cliente

La web cliente recibe eventos por WebSocket desde EVA y no usa Firebase ni notificaciones push. Desde el panel EVA puedes pulsar `Reset cliente` para forzar que los clientes borren caché y recarguen tema/configuración.

## Dependencias

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
