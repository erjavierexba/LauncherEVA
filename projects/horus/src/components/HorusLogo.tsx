// src/components/HorusLogo.tsx

import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { HORUS_THEME } from "../theme/theme";
import {
  DEFAULT_EVA_SERVER,
  EVA_SERVER_STORAGE_KEY,
  isValidEvaServerAddress,
  normalizeEvaHttpAddress,
} from "../services/evaServer";
import { getAppVolume, setAppVolume } from "../services/appAudio";

const { colors, spacing, radius } = HORUS_THEME;

type HorusLogoProps = {
  size?: number;
};

export default function HorusLogo({ size = 54 }: HorusLogoProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [serverAddress, setServerAddress] = useState(DEFAULT_EVA_SERVER);
  const [input, setInput] = useState(DEFAULT_EVA_SERVER);
  const [volume, setVolume] = useState(0.45);

  useEffect(() => {
    async function loadServer() {
      const stored = await AsyncStorage.getItem(EVA_SERVER_STORAGE_KEY);

      if (stored) {
        setServerAddress(stored);
        setInput(stored);
      }
    }

    loadServer();
  }, []);

  useEffect(() => {
    if (!modalVisible) return;

    getAppVolume()
      .then(setVolume)
      .catch(() => {});
  }, [modalVisible]);

  function formatServerAddress(text: string) {
    return text.replace(/[^0-9.:]/g, "");
  }

  async function saveServerAddress() {
    const clean = normalizeEvaHttpAddress(input);

    if (!isValidEvaServerAddress(clean)) {
      Alert.alert("Servidor inválido", "Formato esperado: 192.168.1.42:8080");
      return;
    }

    await AsyncStorage.setItem(EVA_SERVER_STORAGE_KEY, clean);
    setServerAddress(clean);
    setModalVisible(false);
  }

  async function updateVolume(nextVolume: number) {
    const savedVolume = await setAppVolume(nextVolume);
    setVolume(savedVolume);
  }

  return (
    <>
      <Pressable
        delayLongPress={3000}
        onLongPress={() => setModalVisible(true)}
      >
        <Text style={[styles.eye, { fontSize: size }]}>𓂀</Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setInput(serverAddress);
          setModalVisible(false);
        }}
      >
        <View style={styles.backdrop}>
          <View style={styles.box}>
            <Text style={styles.eyeSmall}>𓂀</Text>
            <Text style={styles.title}>SERVIDOR EVA</Text>

            <Text style={styles.label}>Dirección HTTP local</Text>

            <TextInput
              value={input}
              onChangeText={(text) => setInput(formatServerAddress(text))}
              placeholder="192.168.1.42:8080"
              placeholderTextColor={colors.neutral.stone}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <Text style={styles.hint}>Formato: x.x.x.x:8080</Text>

            <View style={styles.volumeBlock}>
              <Text style={styles.label}>Volumen de la app</Text>
              <View style={styles.volumeRow}>
                <Pressable
                  style={styles.volumeButton}
                  onPress={() => {
                    void updateVolume(volume - 0.1);
                  }}
                >
                  <Text style={styles.volumeButtonText}>-</Text>
                </Pressable>
                <Text style={styles.volumeValue}>{Math.round(volume * 100)}%</Text>
                <Pressable
                  style={styles.volumeButton}
                  onPress={() => {
                    void updateVolume(volume + 0.1);
                  }}
                >
                  <Text style={styles.volumeButtonText}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setInput(serverAddress);
                  setModalVisible(false);
                }}
              >
                <Text style={styles.cancelText}>CANCELAR</Text>
              </Pressable>

              <Pressable
                style={[styles.button, styles.saveButton]}
                onPress={saveServerAddress}
              >
                <Text style={styles.saveText}>GUARDAR</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  eye: {
    color: colors.premium,
    textAlign: "center",
    marginBottom: spacing.sm,
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },

  box: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.premium,
  },

  eyeSmall: {
    color: colors.premium,
    fontSize: 42,
    textAlign: "center",
    marginBottom: spacing.sm,
  },

  title: {
    color: colors.textDark,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 3,
    marginBottom: spacing.xl,
  },

  label: {
    color: colors.textDark,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },

  input: {
    backgroundColor: "#120F0F",
    color: colors.textLight,
    borderWidth: 1,
    borderColor: colors.action,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 18,
    letterSpacing: 1,
  },

  hint: {
    color: colors.neutral.stone,
    fontSize: 12,
    marginTop: spacing.sm,
    fontStyle: "italic",
  },

  volumeBlock: {
    marginTop: spacing.lg,
  },

  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },

  volumeButton: {
    width: 44,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.border.dark,
    borderWidth: 1,
    borderColor: colors.premium,
  },

  volumeButtonText: {
    color: colors.textLight,
    fontSize: 22,
    fontWeight: "900",
  },

  volumeValue: {
    flex: 1,
    color: colors.textDark,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "900",
  },

  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
  },

  button: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
    borderWidth: 1,
  },

  cancelButton: {
    backgroundColor: colors.border.dark,
    borderColor: colors.border.dark,
  },

  saveButton: {
    backgroundColor: colors.action,
    borderColor: colors.premium,
  },

  cancelText: {
    color: colors.textLight,
    fontWeight: "900",
  },

  saveText: {
    color: colors.textLight,
    fontWeight: "900",
  },
});
