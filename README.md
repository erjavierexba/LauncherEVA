# Launcher EVA

Launcher EVA es el panel de preparación de una partida/rol. Su objetivo es que una persona sin conocimientos de programación pueda configurar EVA, preparar la app móvil Horus con el nombre del rol, añadir archivos, definir jugadores y arrancar todo desde una interfaz web local.

El launcher no publica nada en internet por sí mismo. Se abre en tu navegador apuntando a `127.0.0.1`, es decir, sólo en tu ordenador.

## Arranque Rápido

Desde esta carpeta:

```bash
PYTHONPATH=src python3 -m launcher_eva
```

El navegador debería abrirse automáticamente. Si no lo hace, copia la URL que aparece en consola, normalmente:

```text
http://127.0.0.1:8787/
```

El puerto puede cambiar si ya está ocupado. El launcher evita usar `8765` porque ese puerto lo reserva EVA para WebSocket.

## Distribución Linux

Launcher EVA puede empaquetarse como binario portable o como `.deb`:

```bash
python -m pip install -e ".[build]"
python scripts/build_exe.py
python scripts/build_deb.py
```

Para que el `.deb` permita generar APKs en una máquina Linux limpia, prepara
antes de construirlo esta carpeta junto al repo:

```text
vendor/
  node/
  jdk/
  android-sdk/
```

El script `scripts/build_deb.py` mete esa carpeta dentro del paquete. Al abrir
Launcher EVA desde el `.deb`, el lanzador copia el ejecutable y `vendor/` a:

```text
~/.local/share/LauncherEVA/
```

Así el usuario final no necesita instalar Python, Node, Java/JDK, Android Studio
ni Android SDK por separado.

El binario onefile `dist/LauncherEVA` también puede llevar `vendor/` embebido.
Si `vendor/` existe al ejecutar `scripts/build_exe.py`, PyInstaller lo incluye
dentro del ejecutable. En el primer arranque, Launcher EVA extrae esa toolchain
junto al binario:

```text
LauncherEVA
vendor/
  node/
  jdk/
  android-sdk/
```

Este modo permite un portable de un solo archivo de entrega, pero el primer
arranque puede tardar más y el binario será muy grande.

Para generar ese onefile completo sin preparar `vendor/` a mano:

```bash
python scripts/build_onefile_with_vendor.py
```

Ese comando descarga y prepara en `vendor/`:

- Node.js LTS para Linux x64.
- JDK 17 Temurin para Linux x64.
- Android SDK Command-line Tools.
- Android Platform Tools.
- `platforms;android-36`.
- `build-tools;35.0.0`.
- `build-tools;36.0.0`.
- `ndk;27.1.12297006`.
- `cmake;3.22.1`.

Después ejecuta `scripts/build_exe.py` y genera `dist/LauncherEVA` con todo
embebido.

El binario portable queda en:

```text
dist/LauncherEVA
```

Al abrirlo, muestra la misma interfaz web dentro de una ventana de escritorio
maximizada, no a pantalla completa. En runtime usa carpetas junto al ejecutable:

```text
LauncherEVA
projects/
assets/
eva.sqlite3
apks/
firebase/
launcher.config.json
```

- `assets/`: archivos que EVA puede enviar o servir; incluye `aliases.json`.
- `eva.sqlite3`: base de datos de EVA, al mismo nivel que el programa.
- `apks/horus/`: APKs copiadas al terminar una build de Horus.
- `firebase/`: credenciales locales configuradas por el usuario, ignoradas por Git.
- `vendor/`: toolchain incluida en el `.deb` o extraída por el onefile; el launcher usa `vendor/node`,
  `vendor/jdk` y `vendor/android-sdk` para generar APKs sin pedir instalaciones.

El paquete `.deb` instala un lanzador `launcher-eva`. En cada arranque copia el
binario a `~/.local/share/LauncherEVA/`, copia `vendor/` si aún no existe, y lo
ejecuta desde ahí para que esas carpetas de datos sean escribibles por el
usuario.

## Generar APKs En Windows

En Windows, si no distribuyes un paquete con `vendor/` incluido, la máquina que
genera la APK debe tener instalado:

- Node.js LTS con `npm`.
- JDK compatible con Android Gradle Plugin, recomendado JDK 17.
- Android Studio o Android SDK Command-line Tools.
- Android SDK Platform correspondiente al `compileSdk` del proyecto.
- Android SDK Build Tools.
- Android SDK Platform Tools.
- Variable `ANDROID_HOME` o `ANDROID_SDK_ROOT` apuntando al SDK.
- `JAVA_HOME` apuntando al JDK.

Después, desde Horus:

```bash
npm install
npm run test
npm run build:release
```

Si quieres el mismo modelo autosuficiente que en Linux, crea también en Windows
una carpeta `vendor/` junto a Launcher EVA con `node/`, `jdk/` y `android-sdk/`.
El launcher prioriza esas rutas cuando existen.

## Flujo Recomendado

1. Abre Launcher EVA.
2. En **Rol y release**, escribe el nombre del rol, paquete Android, rutas de EVA y Horus.
3. Revisa las rutas internas si hace falta y pulsa **Guardar configuración y propagar**.
4. Configura Firebase si quieres notificaciones push.
5. Ajusta colores en **Tema EVA**.
6. Añade jugadores.
7. Sube archivos, bromas y música.
8. Pulsa **Pull ambos public_release** si quieres actualizar los proyectos.
9. Pulsa **Preparar workflow completo** para crear copia segura e instalar dependencias.
10. Pulsa **Arrancar EVA**.
11. Abre el panel de EVA o genera la release de Horus.

## Secciones Del Panel

### Rol y release

Aquí se define la identidad pública del proyecto.

**Nombre del rol / app**

Es el nombre que se propagará a la app Horus y a la configuración de EVA. Por ejemplo:

```text
La Corona de Ceniza
```

El launcher usará este nombre para:

- `app.json` de Horus.
- `package.json` de Horus.
- Textos visibles de la app móvil.
- Título del panel EVA.

**Package Android**

Identificador único de la app Android. Debe tener formato tipo:

```text
com.tuestudio.lacoronadeceniza
```

Importante: si usas Firebase, este package debe coincidir exactamente con el registrado en Firebase Console.

**Subtítulo app**

Texto secundario de la pantalla inicial de Horus.

**Rutas**

- `Ruta EVA`: por defecto `LauncherEVA/projects/Asistente EVA`.
- `Ruta Horus`: por defecto `LauncherEVA/projects/horus`.
- `Remote EVA opcional`: URL git para clonar EVA si la carpeta no existe.
- `Remote Horus opcional`: URL git para clonar Horus si la carpeta no existe.
- `Puerto web EVA`: normalmente `8080`.

**Guardar configuración y propagar**

Este botón aplica los cambios en ambos proyectos:

- Escribe `config/eva.config.json` en EVA.
- Genera/actualiza `src/config/brand.ts` en Horus.
- Actualiza `app.json` y `package.json` de Horus.
- Actualiza colores de Horus desde el tema configurado.
- Configura o limpia Firebase según los archivos indicados.

### Iconos de Horus

Puedes subir:

- `Icono app`: se copia como `assets/icon.png`.
- `Icono adaptive`: se copia como `assets/adaptive-icon.png`.
- `Favicon web`: se copia como `assets/favicon.png`.

Usa imágenes cuadradas en PNG cuando sea posible. Para Android suele funcionar bien una imagen de 1024x1024.

### Audio de Horus

Launcher EVA no incluye música ni efectos MP3 por defecto. Desde el panel puedes
configurar dos archivos locales opcionales:

- `MP3 login Horus`: suena en la pantalla de login.
- `MP3 menú Horus`: suena dentro de la pantalla principal.

Estos archivos se copian como `projects/horus/assets/audio/login.mp3` y
`projects/horus/assets/audio/menu.mp3`, y están ignorados por Git para evitar
publicar música privada o con copyright. Desde el mismo panel puedes quitarlos.

En Horus, mantén pulsado el ojo para abrir la configuración de IP y el volumen
global de la app.

### Firebase

Firebase es opcional, pero necesario si quieres notificaciones push en Android.

El launcher separa dos archivos distintos:

**Service account EVA JSON**

Archivo privado del servidor EVA. Sirve para que EVA pueda enviar notificaciones FCM.

Se descarga en Firebase Console:

```text
Project settings -> Service accounts -> Generate new private key
```

El launcher lo guarda fuera del repo y configura EVA para usar esa ruta. No se debe subir a Git.

**google-services app JSON**

Archivo de la app Android. Debe corresponder al package Android configurado.

Se descarga en Firebase Console al crear una app Android dentro del proyecto Firebase.

Si no configuras este archivo, el launcher elimina `google-services.json` de Horus,
quita los plugins/permisos Firebase de `app.json` y genera una APK sin push.
La app sigue funcionando con polling HTTP contra EVA.

### Pull public_release

Estos botones actualizan los proyectos desde Git:

- **Pull ambos public_release**
- **Pull EVA**
- **Pull Horus**

El launcher primero comprueba si hay cambios locales sin commitear. Si los hay, no hace pull para no pisar trabajo local.
Con la configuración por defecto, EVA y Horus son copias internas de este repo
del launcher; en ese caso el control de versión se hace desde `LauncherEVA` y
estos botones sólo son útiles si apuntas las rutas a repos Git externos.

### Preparar workflow completo

Este botón deja el launcher como responsable de la preparación local de la public release:

- Reaplica la configuración de EVA y Horus.
- Crea una copia segura de EVA y Horus en `managed_releases/`.
- Mantiene un snapshot timestamped y otro en `managed_releases/current/`.
- Guarda un `release.manifest.json` con rama, commit y estado de cada repo.
- Genera un `.git.bundle` por proyecto para conservar el historial recuperable.
- Crea/actualiza `.venv` de EVA e instala `requirements.txt` cuando trabajas desde fuentes.
- Descarga y descomprime `vosk-model-es-0.42` si no existe.
- Ejecuta `npm ci` en Horus cuando existe `package-lock.json`, o `npm install` si no.

EVA y Horus viven físicamente dentro del repo del launcher en `projects/`.
Para que la copia no sea enorme, el snapshot y la copia versionable excluyen dependencias y artefactos
regenerables como `.venv/`, `node_modules/`, `.expo/`, `build/`, `.gradle/`,
`vosk-model-es-0.42/` y el zip de Vosk. El workflow los vuelve a preparar en
los proyectos reales cuando hace falta.

### Ejecutable sin Python

El script `scripts/build_exe.py` genera un ejecutable de Launcher EVA con
`projects/` embebido, para que el usuario final no tenga que instalar Python.
Si también existe `vendor/`, el ejecutable la embebe y la extrae junto al
programa en el primer arranque:

```text
vendor/node/
vendor/jdk/
vendor/android-sdk/
```

En Linux, el flujo más limpio para una distribución autosuficiente sigue siendo
crear el `.deb` con `vendor/` incluido. El onefile con `vendor/` embebido queda
soportado para entregas portables donde se quiera un único archivo.

Para preparar y construir ese onefile completo en un solo paso:

```bash
python scripts/build_onefile_with_vendor.py
```

Si esas carpetas existen, el launcher las usa automáticamente al ejecutar `npm`,
Gradle y las herramientas Android. Sin esa toolchain incluida, el launcher puede
configurar EVA/Horus, pero no puede generar una APK en una máquina que no tenga
Node, Java y Android SDK disponibles.

### Generar release Horus

Ejecuta:

```bash
npm run test
npm run build:release
```

Requisitos:

- Linux `.deb` autosuficiente: `vendor/node`, `vendor/jdk` y
  `vendor/android-sdk` incluidos en el paquete.
- Windows: Node, Java/JDK y Android SDK instalados en el sistema o disponibles
  en `vendor/`.
- `google-services.json` correcto sólo si quieres FCM.

Si falta Firebase, el build continúa y genera una APK sin notificaciones push.
Si hay `google-services.json`, el launcher valida que corresponda al package
Android configurado.

## Tema EVA

Permite cambiar colores del panel EVA y propagarlos también a Horus.

Cada color tiene:

- Selector visual HTML5.
- Campo de texto con el valor hexadecimal.

Campos principales:

- `background`: fondo general.
- `surface`: paneles.
- `surfaceAlt`: paneles secundarios.
- `text`: texto principal.
- `muted`: texto secundario.
- `accent`: color destacado.
- `primary`: acciones principales.
- `danger`: acciones peligrosas.
- `radius`: radio de bordes, por ejemplo `8px`.

También hay presets:

- EVA oscuro.
- Clínico.
- Arcano.

## Jugadores

Permite definir jugadores disponibles para EVA y Horus.

Cada jugador tiene:

- Nombre.
- Alias separados por coma.

Ejemplo:

```text
Nombre: Alicia
Alias: ali, la maga, jugadora uno
```

EVA usará los alias para reconocer destinatarios por voz o desde el panel.

## Archivos

Añade archivos al catálogo `media/` de EVA.

Formatos permitidos:

- `.md`
- `.png`
- `.mp4`
- `.ogg`
- `.mp3`
- `.wav`
- `.webm`
- `.pdf`

Al subir un archivo puedes indicar:

- Nombre visible.
- Alias separados por coma.

Después podrás enviarlo desde EVA a todos o a un jugador concreto.

## Bromas Rápidas

Crea un archivo Markdown dentro de `media/`.

Útil para:

- Mensajes sorpresa.
- Notas falsas.
- Pistas.
- Textos de ambientación.
- Bromas internas de la mesa.

El launcher genera un `.md` y registra sus alias.

## Música de Intro

Permite subir un MP3 que se copiará como:

```text
Asistente EVA/assets/music/despertar.mp3
```

Ese archivo se usa como música de intro/despertar en EVA.

## Arrancar y Detener EVA

**Arrancar EVA** ejecuta:

```bash
python main.py
```

desde la carpeta de EVA. Si existe `.venv`, usa el Python del entorno virtual.

EVA levanta:

- Panel web HTTP en `8080`.
- WebSocket en `8765`.
- Reconocimiento de voz.
- Servicios de media, música, plantillas y notificaciones.

**Detener EVA** sólo detiene el proceso arrancado desde este launcher.

## Logs

La columna de logs muestra:

- Comandos Git.
- Estado de arranque de EVA.
- Errores de Firebase.
- Errores de build.
- Copias de archivos.
- Procesos detenidos o terminados.

Si algo falla, normalmente la explicación aparece ahí.

## Qué Archivos Modifica

En EVA:

```text
config/eva.config.json
config/firebase-service-account.json
media/
media/aliases.json
```

En Horus:

```text
app.json
package.json
src/config/brand.ts
src/theme/theme.ts
assets/icon.png
assets/adaptive-icon.png
assets/favicon.png
google-services.json
assets/audio/login.mp3
assets/audio/menu.mp3
```

En Launcher EVA:

```text
launcher.config.json
firebase/
```

Estos últimos están ignorados por Git.

## Seguridad

No subas nunca a Git:

- `firebase-service-account.json`
- `google-services.json` si pertenece a un proyecto privado.
- `launcher.config.json`
- carpetas generadas con credenciales.

La release pública está preparada para no incluir tus credenciales. El usuario final debe configurar su propio Firebase desde el launcher.

Si no se configura Firebase:

- EVA funciona igualmente.
- Horus funciona igualmente.
- Las notificaciones push FCM no estarán disponibles.
- La generación de release Android sigue funcionando sin FCM.

## Solución de Problemas

### EVA falla con `address already in use` en 8765

Otro proceso ya está usando el puerto WebSocket de EVA.

Soluciones:

- Cierra otra instancia de EVA.
- Asegúrate de usar una versión del launcher que abre en `8787` o superior.

### El launcher no abre navegador

Abre manualmente la URL que aparece en consola:

```text
http://127.0.0.1:8787/
```

### Pull no hace nada

Si hay cambios locales sin commitear, el launcher no hace pull para no pisarlos. Revisa el log.

### Build Horus falla por Firebase

Comprueba:

- Que subiste `google-services.json`.
- Que el package Android coincide con el registrado en Firebase.
- Que pulsaste **Guardar configuración y propagar**.

### EVA no envía push

Comprueba:

- Que subiste el service account JSON.
- Que EVA fue reiniciada después de configurarlo.
- Que la app Horus abrió sesión y registró token.

### La app Horus no cambia de nombre

Pulsa:

```text
Guardar configuración y propagar
```

Después recompila la app.

## Crear Ejecutable

Instala PyInstaller:

```bash
python3 -m pip install pyinstaller
```

Genera el ejecutable:

```bash
python3 scripts/build_exe.py
```

El resultado queda en:

```text
dist/LauncherEVA
```

Al abrirlo, levanta el panel local y abre el navegador.
