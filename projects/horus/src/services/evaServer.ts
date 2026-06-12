import AsyncStorage from "@react-native-async-storage/async-storage";

export const EVA_SERVER_STORAGE_KEY = "eva_server_address";
export const DEFAULT_EVA_SERVER = "192.168.0.18:8080";
export const EVA_HTTP_PORT = 8080;
export const EVA_WS_PORT = 8765;

export async function getStoredEvaHttpBaseUrl() {
  const stored = await AsyncStorage.getItem(EVA_SERVER_STORAGE_KEY);

  return getEvaHttpBaseUrl(stored ?? DEFAULT_EVA_SERVER);
}

export function getEvaHttpBaseUrl(serverAddress: string) {
  const clean = serverAddress.trim().replace(/\/+$/, "");

  if (/^https?:\/\//i.test(clean)) {
    return clean.replace(`:${EVA_WS_PORT}`, `:${EVA_HTTP_PORT}`);
  }

  return `http://${normalizeEvaHttpAddress(clean)}`;
}

export function normalizeEvaHttpAddress(serverAddress: string) {
  const clean = serverAddress.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const [host, port] = clean.split(":");

  if (!host) {
    return DEFAULT_EVA_SERVER;
  }

  if (!port || port === String(EVA_WS_PORT)) {
    return `${host}:${EVA_HTTP_PORT}`;
  }

  return `${host}:${port}`;
}

export function isValidEvaServerAddress(serverAddress: string) {
  const clean = serverAddress.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const validFormat = /^(\d{1,3}\.){3}\d{1,3}:\d{1,5}$/.test(clean);

  if (!validFormat) return false;

  const [ip, port] = clean.split(":");
  const ipNumbers = ip.split(".").map(Number);
  const portNumber = Number(port);

  return (
    ipNumbers.every((n) => n >= 0 && n <= 255) &&
    portNumber > 0 &&
    portNumber <= 65535
  );
}
