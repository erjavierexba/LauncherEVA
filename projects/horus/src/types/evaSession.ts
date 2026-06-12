import { CountdownData } from "../components/CountdownModal";
import { MediaResource } from "../components/MediaResourceModal";
import { CharacterSheet } from "./characterSheet";

export type ActiveNotification = {
  id: string | number | null;
  kind:
    | "media"
    | "countdown"
    | "countdownCancel"
    | "templateUpdate"
    | "sheetUpdate"
    | "elimination";
  resource?: MediaResource;
  countdown?: CountdownData;
  sheet?: CharacterSheet;
  characterId?: number;
};

export type NotificationData = {
  id?: string | number;
  notificationId?: string | number;
  notificacionId?: string | number;
  tipo?: string;
  destinatario?: string;
  valor?: unknown;
  data?: unknown;
  resource?: unknown;
  recurso?: unknown;
};

export type NotificationResponse = {
  hasNotifications?: boolean;
  data?: unknown;
};

export type PlayerCharacter = {
  id: number;
  name: string;
  role: string;
  playerName: string;
  sheet: CharacterSheet | null;
};

export type SessionMediaResource = {
  key: string;
  resource: MediaResource;
  receivedAt: Date;
};
