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

## Aplicación de escritorio

El ejecutable de escritorio arranca EVA en segundo plano, abre el configurador en una ventana propia y deja publicada la web de jugadores en el puerto cliente.

```bash
PYTHONPATH=src python3 -m launcher_eva.desktop
```

Si cambias el puerto EVA o el puerto cliente desde la configuración, la ventana detecta el cambio, reinicia EVA y recarga el configurador en el puerto nuevo.

Al abrir, la app comprueba si la configuración escucha en LAN (`0.0.0.0`) y muestra avisos de firewall. En Linux con UFW activo indicará comandos como:

```bash
sudo ufw allow 8000/tcp
sudo ufw allow 8080/tcp
```

En Windows indicará el comando `netsh advfirewall` equivalente para ejecutar como administrador si los jugadores no pueden conectar.

## Empaquetado

Crear ejecutable portable:

```bash
python3 scripts/build_exe.py
```

Crear paquete `.deb`:

```bash
python3 scripts/build_deb.py
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
