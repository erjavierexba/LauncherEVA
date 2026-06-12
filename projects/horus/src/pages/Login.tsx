import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { HORUS_THEME } from "../theme/theme";
import { APP_BRAND } from "../config/brand";
import { saveUsername } from "../storage/usernameStorage";
import { BackHandler } from "react-native";
import HorusLogo from "../components/HorusLogo";
import { getStoredEvaHttpBaseUrl } from "../services/evaServer";
import { HORUS_AUDIO_ASSETS } from "../config/audioAssets";
import { playLoopingAudio, stopLoopingAudio } from "../services/appAudio";

const { colors, spacing, radius } = HORUS_THEME;
const DEFAULT_INPUT_TEXT = "Introduce la clave";

type LoginProps = {
  onLoginSuccess: (username: string) => void;
};


export default function Login({ onLoginSuccess }: LoginProps) {
  const [inputUsername, setInputUsername] = useState("");
  const [error, setError] = useState<string>('')
  const [inputText, setInputText] = useState(DEFAULT_INPUT_TEXT);
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const dread = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let sound: Awaited<ReturnType<typeof playLoopingAudio>> = null;
    let cancelled = false;

    playLoopingAudio(HORUS_AUDIO_ASSETS.login)
      .then((nextSound) => {
        if (cancelled) {
          void stopLoopingAudio(nextSound);
          return;
        }

        sound = nextSound;
      })
      .catch((error) => {
        console.log("[Audio] Login desactivado:", error);
      });

    return () => {
      cancelled = true;
      void stopLoopingAudio(sound);
    };
  }, []);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.03,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(dread, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(dread, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

 

  function playShake() {
    Animated.sequence([
      Animated.timing(shake, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }

  async function handleSaveUsername() {
    try {
      const cleanUsername = inputUsername.trim();

      if (!cleanUsername) {
        setError("Introduce la clave");
        return;
      }

      const normalized = await loginWithEva(cleanUsername);

      await saveUsername(normalized);
      

      onLoginSuccess(normalized);
    } catch (error) { 
      playShake();
      setError(error instanceof Error ? error.message : "Clave inválida.");

      Alert.alert(
        "ACCESO DENEGADO",
        error instanceof Error ? error.message : "Clave inválida."
      );
    }
  }

  function triggerHorusEasterEgg() {
    setInputText("No deberías haber escrito eso.");
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(fade, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        BackHandler.exitApp();
      });
    }, 700)
    
  }

  return (
    <View style={styles.container}>
      <DreadBackdrop dread={dread} />
      <Animated.View
        style={[
          styles.panel,
          {
            opacity: fade,
            transform: [{ scale: pulse }, { translateX: shake }],
          },
        ]}
      >
        <HorusLogo />

        <Text style={styles.title}>{APP_BRAND.displayName}</Text>

        <Text style={styles.subtitle}>
          {APP_BRAND.subtitle}
        </Text>

        <Text
          style={[
            styles.label,
            inputText !== DEFAULT_INPUT_TEXT && styles.errorLabel,
          ]}
        >
          {inputText}
        </Text>

        <TextInput
          value={inputUsername}
          onChangeText={(text) => {
            setInputUsername(text);

            const normalized = text.toLowerCase().trim();

            if (normalized === "horus") {
              triggerHorusEasterEgg();
            }
          }}
          placeholder="..."
          placeholderTextColor={colors.neutral.stone}
          autoCapitalize="none"
          style={styles.input}
        />

        <Pressable style={styles.button} onPress={handleSaveUsername}>
          <Text style={styles.buttonText}>SELLAR IDENTIDAD</Text>
        </Pressable>
        {error !== '' && 
          <Text style={styles.warning}>
            {error}
          </Text>
        }
        <Text style={styles.warning}>
          La identidad quedará sellada. EVA recordará el intento.
        </Text>
      </Animated.View>
    </View>
  );
}

function DreadBackdrop({ dread }: { dread: Animated.Value }) {
  return (
    <View pointerEvents="none" style={styles.dreadBackdrop}>
      <Animated.View
        style={[
          styles.redVeil,
          {
            opacity: dread.interpolate({
              inputRange: [0, 1],
              outputRange: [0.08, 0.25],
            }),
          },
        ]}
      />
      <View style={styles.scratchOne} />
      <View style={styles.scratchTwo} />
      <View style={styles.scanLine} />
    </View>
  );
}

async function loginWithEva(username: string) {
  const baseUrl = await getStoredEvaHttpBaseUrl();
  const response = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username }),
  });
  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.mensaje || "Clave inválida.");
  }

  if (typeof data.username !== "string") {
    throw new Error("Respuesta inválida de EVA.");
  }

  return data.username;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030405",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },

  dreadBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#030405",
    overflow: "hidden",
  },

  redVeil: {
    position: "absolute",
    top: -90,
    left: -70,
    right: -70,
    height: 270,
    backgroundColor: "#7A0D0D",
    borderBottomLeftRadius: 260,
    borderBottomRightRadius: 260,
  },

  scratchOne: {
    position: "absolute",
    top: "25%",
    left: -18,
    width: "72%",
    height: 1,
    backgroundColor: "rgba(201, 162, 74, 0.2)",
    transform: [{ rotate: "-8deg" }],
  },

  scratchTwo: {
    position: "absolute",
    bottom: "22%",
    right: -18,
    width: "66%",
    height: 1,
    backgroundColor: "rgba(139, 30, 30, 0.48)",
    transform: [{ rotate: "10deg" }],
  },

  scanLine: {
    position: "absolute",
    top: "58%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },

  loadingText: {
    color: colors.textLight,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 2,
    marginTop: spacing.md,
  },

  errorLabel: {
    color: colors.action,
  },

  panel: {
    width: "100%",
    backgroundColor: "rgba(9, 10, 12, 0.96)",
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: "rgba(201, 162, 74, 0.62)",
  },

  eye: {
    color: colors.premium,
    fontSize: 54,
    textAlign: "center",
    marginBottom: spacing.sm,
  },

  title: {
    color: colors.textLight,
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 4,
    textShadowColor: "rgba(139, 30, 30, 0.9)",
    textShadowRadius: 16,
  },

  subtitle: {
    color: "#C23B3B",
    fontSize: 13,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    letterSpacing: 1,
  },

  label: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },

  input: {
    backgroundColor: "#050506",
    color: colors.textLight,
    borderWidth: 1,
    borderColor: colors.action,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 18,
    marginBottom: spacing.lg,
    letterSpacing: 1,
  },

  button: {
    backgroundColor: "#3B080A",
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.premium,
  },

  buttonText: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2,
  },
  
  error: {
    color: colors.action,
    fontSize: 14, 
    marginTop: spacing.md,
  },
  
  warning: {
    color: "#8D8580",
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.md,
    fontStyle: "italic",
  },
});
