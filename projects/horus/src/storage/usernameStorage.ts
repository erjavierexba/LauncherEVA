import * as SecureStore from "expo-secure-store";

const USERNAME_KEY = "horus_username";

export async function getUsername(): Promise<string | null> {
  return await SecureStore.getItemAsync(USERNAME_KEY);
}

export async function clearStorage() {
  await SecureStore.deleteItemAsync("horus_username");
  console.log("Username borrado");
}

export async function saveUsername(username: string): Promise<void> {
  const cleanUsername = username.trim();

  if (!cleanUsername) {
    throw new Error("El nombre no puede estar vacío.");
  }

  const existingUsername = await getUsername();

  if (existingUsername) {
    throw new Error("El username ya está configurado.");
  }

  await SecureStore.setItemAsync(USERNAME_KEY, cleanUsername);
}