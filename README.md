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

## Flujo Recomendado

1. Abre Launcher EVA.
2. En **Rol y release**, escribe el nombre del rol, paquete Android, rutas de EVA y Horus.
3. Pulsa **Guardar configuración y propagar**.
4. Configura Firebase si quieres notificaciones push.
5. Ajusta colores en **Tema EVA**.
6. Añade jugadores.
7. Sube archivos, bromas y música.
8. Pulsa **Pull ambos public_release** si quieres actualizar los proyectos.
9. Pulsa **Arrancar EVA**.
10. Abre el panel de EVA o genera la release de Horus.

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

- `Ruta EVA`: carpeta del proyecto Asistente EVA.
- `Ruta Horus`: carpeta del proyecto Horus.
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

Si no configuras este archivo, el launcher elimina `android/app/google-services.json` de Horus para evitar que se use uno personal por accidente.

### Pull public_release

Estos botones actualizan los proyectos desde Git:

- **Pull ambos public_release**
- **Pull EVA**
- **Pull Horus**

El launcher primero comprueba si hay cambios locales sin commitear. Si los hay, no hace pull para no pisar trabajo local.

### Generar release Horus

Ejecuta:

```bash
npm run test
npm run build:release
```

Requisitos:

- Node y dependencias instaladas.
- Android/Gradle configurado.
- `google-services.json` correcto si FCM está activado.

Si falta Firebase, el build debe fallar antes de Gradle. Eso es intencionado: evita compilar una APK usando el Firebase equivocado.

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
assets/music/despertar.mp3
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
android/app/google-services.json
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
- La generación de release Android con FCM fallará hasta que haya `google-services.json`.

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
