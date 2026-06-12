import { CountdownData } from "../components/CountdownModal";
import { MediaResource } from "../components/MediaResourceModal";
import {
  ActiveNotification,
  NotificationData,
  NotificationResponse,
} from "../types/evaSession";
import { extractSheet, isObject, toNumber } from "./characterSheetModel";

export function extractNotification(
  response: NotificationResponse,
  username: string
): ActiveNotification | null {
  if (response.hasNotifications === false) return null;

  const raw = response.data ?? response;

  if (!isObject(raw)) return null;

  const recipient = typeof raw.destinatario === "string" ? raw.destinatario : null;

  if (recipient && recipient !== username && recipient !== "TODOS") {
    return null;
  }

  const notificationId =
    getNotificationId(raw) ?? (isObject(raw.data) ? getNotificationId(raw.data) : null);
  const payload = isObject(raw.data) ? raw.data : raw;
  const type = typeof payload.tipo === "string" ? payload.tipo : null;
  const value = payload.valor;
  const directResource = payload.resource ?? payload.recurso;

  if (
    (type === "MUESTRA" || isObject(directResource)) &&
    isMediaResource(directResource ?? value)
  ) {
    return {
      id: notificationId,
      kind: "media",
      resource: (directResource ?? value) as MediaResource,
    };
  }

  if (type === "COUNTDOWN" && isCountdownData(value)) {
    return {
      id: notificationId,
      kind: "countdown",
      countdown: value,
    };
  }

  if (type === "COUNTDOWN_CANCEL") {
    return {
      id: notificationId,
      kind: "countdownCancel",
    };
  }

  if (type === "TEMPLATE_UPDATE") {
    return {
      id: notificationId,
      kind: "templateUpdate",
    };
  }

  if (type === "CHARACTER_SHEET_UPDATE") {
    const sheet = isObject(value) ? extractSheet({ sheet: value.sheet }) : null;
    const characterId = isObject(value)
      ? toNumber(value.characterId) ?? (isObject(value.character) ? toNumber(value.character.id) : null)
      : null;

    return {
      id: notificationId,
      kind: "sheetUpdate",
      sheet: sheet || undefined,
      characterId: characterId ?? undefined,
    };
  }

  if (type === "ELIMINAR_JUGADOR") {
    return {
      id: notificationId,
      kind: "elimination",
    };
  }

  return null;
}

export function getNotificationId(data: NotificationData) {
  return data.id ?? data.notificationId ?? data.notificacionId ?? null;
}

export function getResourceKey(resource: MediaResource) {
  return `${resource.tipo}:${resource.nombre}:${resource.url}`;
}

export function getMediaNotificationKey(notification: ActiveNotification | null, resource: MediaResource) {
  return `${notification?.id ?? "direct"}:${getResourceKey(resource)}`;
}

export function getCountdownKey(countdown: CountdownData) {
  return `${countdown.targetAt}:${countdown.label ?? ""}`;
}

export function formatResourceTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isMediaResource(value: unknown): value is MediaResource {
  return (
    isObject(value) &&
    typeof value.tipo === "string" &&
    ["TEXTO", "IMAGEN", "AUDIO", "VIDEO", "DOCUMENTO"].includes(value.tipo) &&
    typeof value.nombre === "string" &&
    typeof value.url === "string"
  );
}

export function isCountdownData(value: unknown): value is CountdownData {
  return (
    isObject(value) &&
    typeof value.targetAt === "string" &&
    !Number.isNaN(Date.parse(value.targetAt))
  );
}
