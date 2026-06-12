# FCM directo en Android

## Cliente

La app ya tiene React Native Firebase instalado y registra:

- permiso `POST_NOTIFICATIONS` en Android 13+
- token FCM del dispositivo
- listeners de foreground, background y apertura desde notificacion

El archivo de Firebase debe colocarse en:

```text
android/app/google-services.json
```

Debe corresponder al paquete Android:

```text
El valor actual de expo.android.package en app.json
```

En la release pública, Launcher EVA copia este archivo desde la configuración
del rol. No dejes un `google-services.json` personal dentro del proyecto.

Puedes comprobarlo antes de compilar:

```bash
npm run check:firebase
```

Si falta el archivo, `npm run release:android` y `npm run build:release`
fallan antes de entrar en Gradle.

## Token

Al entrar en `MainApp`, la app obtiene el token FCM, lo guarda en AsyncStorage bajo `horus_fcm_token` y lo envia a EVA:

```text
PUT /push-token/{userName}
```

La direccion de EVA que se guarda en la app debe apuntar al servidor HTTP:

```text
192.168.1.42:8080
```

Si por costumbre escribes `:8765`, la app lo normaliza a `:8080` para las
peticiones HTTP. El puerto `8765` queda reservado para WebSocket en EVA.

Tambien lo imprime en consola como:

```text
[FCM] Token <token>
```

## Payload recomendado

Para que Android muestre la notificacion aunque la app este cerrada, envia un mensaje FCM con bloque `notification` y `data`:

```json
{
  "token": "<fcm-token>",
  "notification": {
    "title": "Horus",
    "body": "Tienes una notificacion pendiente"
  },
  "data": {
    "type": "pending_notification"
  },
  "android": {
    "priority": "high"
  }
}
```

Cuando la app recibe o abre ese push, fuerza una consulta inmediata a:

```text
GET /notifications/{userName}
```

El recurso completo debe seguir viniendo de tu API, no del push.

## Prueba end-to-end

Con EVA arrancada, la app abierta al menos una vez y el usuario logueado:

```bash
curl -X POST http://IP_DE_EVA:8080/api/push/test/Ale
```

Si el token esta registrado y `firebase-service-account.json` esta configurado
en EVA, el movil deberia recibir una notificacion de prueba.
