import { PermissionsAndroid, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getStoredEvaHttpBaseUrl } from "./evaServer";

declare const require: (moduleName: string) => any;

const FCM_TOKEN_STORAGE_KEY = "horus_fcm_token";

type InitializeFcmOptions = {
  username: string;
  onPendingNotification: () => void;
};

type FirebaseMessagingModule = {
  AuthorizationStatus: {
    AUTHORIZED: number;
    PROVISIONAL: number;
  };
  getInitialNotification: (messaging: unknown) => Promise<RemoteMessage | null>;
  getMessaging: () => unknown;
  getToken: (messaging: unknown) => Promise<string>;
  onMessage: (messaging: unknown, handler: (message: RemoteMessage) => void) => () => void;
  onNotificationOpenedApp: (messaging: unknown, handler: (message: RemoteMessage) => void) => () => void;
  onTokenRefresh: (messaging: unknown, handler: (token: string) => void | Promise<void>) => () => void;
  registerDeviceForRemoteMessages: (messaging: unknown) => Promise<void>;
  requestPermission: (messaging: unknown) => Promise<number>;
  setBackgroundMessageHandler: (messaging: unknown, handler: (message: RemoteMessage) => Promise<void>) => void;
};

type RemoteMessage = {
  messageId?: string;
  data?: Record<string, unknown>;
};

export async function initializeFcm({
  username,
  onPendingNotification,
}: InitializeFcmOptions) {
  const firebase = loadFirebaseMessaging();

  if (!firebase) {
    console.log("[FCM] Firebase no configurado. Push desactivado.");
    return () => {};
  }

  try {
    const messaging = firebase.getMessaging();
    const granted = await requestFcmPermission(firebase, messaging);

    if (!granted) {
      console.log("[FCM] Notification permission denied");
      return () => {};
    }

    await firebase.registerDeviceForRemoteMessages(messaging);
    await refreshStoredFcmToken(firebase, messaging, username);

    const unsubscribeMessage = firebase.onMessage(messaging, (message) => {
      console.log("[FCM] Foreground message", message.messageId, message.data);

      if (isPendingNotificationPush(message)) {
        onPendingNotification();
      }
    });

    const unsubscribeOpened = firebase.onNotificationOpenedApp(messaging, (message) => {
      console.log("[FCM] Notification opened", message.messageId, message.data);

      if (isPendingNotificationPush(message)) {
        onPendingNotification();
      }
    });

    const unsubscribeTokenRefresh = firebase.onTokenRefresh(messaging, async (token) => {
      await storeFcmToken(username, token);
      await sendFcmTokenToServer(username, token).catch((err) => {
        console.log("[FCM] Token registration error:", err);
      });
      console.log("[FCM] Token refreshed", token);
    });

    const initialMessage = await firebase.getInitialNotification(messaging);

    if (initialMessage && isPendingNotificationPush(initialMessage)) {
      onPendingNotification();
    }

    return () => {
      unsubscribeMessage();
      unsubscribeOpened();
      unsubscribeTokenRefresh();
    };
  } catch (err) {
    console.log("[FCM] No disponible en esta build:", err);
    return () => {};
  }
}

export function setupBackgroundFcmHandler() {
  const firebase = loadFirebaseMessaging();

  if (!firebase) return;

  try {
    firebase.setBackgroundMessageHandler(firebase.getMessaging(), async (message) => {
      console.log("[FCM] Background message", message.messageId, message.data);
    });
  } catch (err) {
    console.log("[FCM] Background handler desactivado:", err);
  }
}

function loadFirebaseMessaging(): FirebaseMessagingModule | null {
  try {
    return require("@react-native-firebase/messaging") as FirebaseMessagingModule;
  } catch {
    return null;
  }
}

async function requestFcmPermission(firebase: FirebaseMessagingModule, messaging: unknown) {
  if (Platform.OS === "android" && Platform.Version >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      {
        title: "Permitir notificaciones",
        message: "Horus puede avisarte cuando tengas una notificacion pendiente.",
        buttonPositive: "Permitir",
        buttonNegative: "Ahora no",
      }
    );

    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  const status = await firebase.requestPermission(messaging);

  return (
    status === firebase.AuthorizationStatus.AUTHORIZED ||
    status === firebase.AuthorizationStatus.PROVISIONAL
  );
}

async function refreshStoredFcmToken(
  firebase: FirebaseMessagingModule,
  messaging: unknown,
  username: string
) {
  const token = await firebase.getToken(messaging);

  await storeFcmToken(username, token);
  await sendFcmTokenToServer(username, token).catch((err) => {
    console.log("[FCM] Token registration error:", err);
  });
  console.log("[FCM] Token", token);
}

async function storeFcmToken(username: string, token: string) {
  await AsyncStorage.setItem(
    FCM_TOKEN_STORAGE_KEY,
    JSON.stringify({
      username,
      token,
      updatedAt: new Date().toISOString(),
    })
  );
}

async function sendFcmTokenToServer(username: string, token: string) {
  const baseUrl = await getStoredEvaHttpBaseUrl();

  const response = await fetch(
    `${baseUrl}/push-token/${encodeURIComponent(username)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

function isPendingNotificationPush(message: RemoteMessage) {
  const type = message.data?.type;

  return (
    type === undefined ||
    type === "pending_notification" ||
    type === "notification_pending" ||
    type === "horus_notification_pending"
  );
}
