import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { HORUS_THEME } from "./src/theme/theme";
import { clearStorage, getUsername } from "./src/storage/usernameStorage";
import Login from "./src/pages/Login";
import MainApp from "./src/pages/MainApp";
import { APP_BRAND } from "./src/config/brand";
 

const { colors, spacing } = HORUS_THEME;

export default function App() {
  
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    async function checkUsername() {
      const storedUsername = await getUsername();

      setUsername(storedUsername);
      setLoading(false);
    }

    checkUsername();
  }, []);

  function handleLoginSuccess(newUsername: string) {
    setUsername(newUsername);
  }

  async function handleLogout() {
    await clearStorage();
    setUsername(null);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Cargando {APP_BRAND.appName}...</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      {username ? (
        <MainApp username={username} onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}

      <StatusBar style="light" />
    </>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },

  loadingText: {
    color: colors.textLight,
    marginTop: spacing.md,
    fontSize: 16,
  },
});
