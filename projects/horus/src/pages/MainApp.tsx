import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import MediaResourceModal, { MediaResource } from "../components/MediaResourceModal";
import CountdownModal, { CountdownData } from "../components/CountdownModal";
import CharacterSheetPanel, { DrawerKey } from "../components/CharacterSheetPanel";
import { AppHeader, DreadBackdrop, LoadingCard } from "../components/HorusShell";
import { initializeFcm } from "../services/fcm";
import { HORUS_AUDIO_ASSETS } from "../config/audioAssets";
import { playLoopingAudio, stopLoopingAudio } from "../services/appAudio";
import { getStoredEvaHttpBaseUrl } from "../services/evaServer";
import {
  CharacterSheet,
  CharacterSheetField,
} from "../types/characterSheet";
import {
  ActiveNotification,
  NotificationResponse,
  PlayerCharacter,
  SessionMediaResource,
} from "../types/evaSession";
import {
  extractCharacters,
  extractSheet,
  GENERIC_TAB_KEY,
  getDynamicPages,
  TOOLS_TAB_KEY,
} from "../utils/characterSheetModel";
import {
  extractNotification,
  getCountdownKey,
  getMediaNotificationKey,
  getResourceKey,
} from "../utils/evaNotifications";
import { styles } from "./MainApp.styles";

type MainAppProps = {
  username: string;
  onLogout: () => void | Promise<void>;
};

const POLLING_DELAY = 3000;

export default function MainApp({ username, onLogout }: MainAppProps) {
  const [mediaResource, setMediaResource] = useState<MediaResource | null>(null);
  const [mediaVisible, setMediaVisible] = useState(false);
  const [countdown, setCountdown] = useState<CountdownData | null>(null);
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [sheet, setSheet] = useState<CharacterSheet | null>(null);
  const [characters, setCharacters] = useState<PlayerCharacter[]>([]);
  const [activeCharacterId, setActiveCharacterId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [resourceHistory, setResourceHistory] = useState<SessionMediaResource[]>([]);
  const [activeDrawer, setActiveDrawer] = useState<DrawerKey | null>(null);
  const [activeSheetTab, setActiveSheetTab] = useState(GENERIC_TAB_KEY);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dreadAnim = useRef(new Animated.Value(0)).current;
  const sheetDrawerAnim = useRef(new Animated.Value(0)).current;
  const diceDrawerAnim = useRef(new Animated.Value(0)).current;
  const filesDrawerAnim = useRef(new Animated.Value(0)).current;
  const activeNotificationRef = useRef<ActiveNotification | null>(null);
  const activeCharacterIdRef = useRef<number | null>(null);
  const pollingPausedRef = useRef(false);
  const requestNextNotificationRef = useRef<(() => void) | null>(null);
  const minimizedCountdownKeyRef = useRef<string | null>(null);
  const dismissedMediaKeyRef = useRef<string | null>(null);

  const dynamicPages = getDynamicPages(sheet);
  const activeCharacter = characters.find((character) => character.id === activeCharacterId) || null;
  const activeDynamicTab =
    activeSheetTab === GENERIC_TAB_KEY ||
    activeSheetTab === TOOLS_TAB_KEY ||
    dynamicPages.some((page) => page.key === activeSheetTab)
      ? activeSheetTab
      : GENERIC_TAB_KEY;

  useEffect(() => {
    let sound: Awaited<ReturnType<typeof playLoopingAudio>> = null;
    let cancelled = false;

    playLoopingAudio(HORUS_AUDIO_ASSETS.menu)
      .then((nextSound) => {
        if (cancelled) {
          void stopLoopingAudio(nextSound);
          return;
        }

        sound = nextSound;
      })
      .catch((error) => {
        console.log("[Audio] Menu desactivado:", error);
      });

    return () => {
      cancelled = true;
      void stopLoopingAudio(sound);
    };
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(dreadAnim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(dreadAnim, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    pollingPausedRef.current = mediaVisible;

    if (!pollingPausedRef.current) {
      requestNextNotificationRef.current?.();
    }
  }, [mediaVisible, countdownVisible]);

  useEffect(() => {
    setResourceHistory([]);
  }, [username]);

  useEffect(() => {
    const config = {
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    };

    Animated.parallel([
      Animated.timing(sheetDrawerAnim, {
        toValue: activeDrawer === "sheet" ? 1 : 0,
        ...config,
      }),
      Animated.timing(diceDrawerAnim, {
        toValue: activeDrawer === "dice" ? 1 : 0,
        ...config,
      }),
      Animated.timing(filesDrawerAnim, {
        toValue: activeDrawer === "files" ? 1 : 0,
        ...config,
      }),
    ]).start();
  }, [activeDrawer, diceDrawerAnim, filesDrawerAnim, sheetDrawerAnim]);

  useEffect(() => {
    const firstPage = getDynamicPages(sheet)[0];
    setActiveSheetTab((current) => (
      current === GENERIC_TAB_KEY ||
      current === TOOLS_TAB_KEY ||
      getDynamicPages(sheet).some((page) => page.key === current)
        ? current
        : firstPage?.key || GENERIC_TAB_KEY
    ));
  }, [sheet?.template.key, sheet?.template.schema]);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | null = null;

    initializeFcm({
      username,
      onPendingNotification: () => {
        requestNextNotificationRef.current?.();
      },
    })
      .then((unsubscribe) => {
        if (!mounted) {
          unsubscribe();
          return;
        }

        cleanup = unsubscribe;
      })
      .catch((err) => {
        console.log("[FCM] Initialization error:", err);
      });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [username]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let baseUrl = "";

    function clearPollTimer() {
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    }

    function scheduleNextPoll(delay = POLLING_DELAY) {
      clearPollTimer();

      if (cancelled) return;

      pollTimer = setTimeout(() => {
        void requestNextNotification();
      }, delay);
    }

    async function loadInitialState() {
      const response = await fetch(`${baseUrl}/load/${encodeURIComponent(username)}`);

      if (response.status === 403) {
        await handleEliminated();
        throw new Error("PLAYER_ELIMINATED");
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const loadedCharacters = extractCharacters(data);
      const fallbackSheet = extractSheet(data);
      const nextActiveCharacter =
        loadedCharacters.find((character) => character.id === activeCharacterIdRef.current) ||
        loadedCharacters[0] ||
        null;
      const loadedSheet = nextActiveCharacter?.sheet || fallbackSheet;

      if (cancelled) return;

      setCharacters(loadedCharacters);
      setActiveCharacterId(nextActiveCharacter?.id ?? null);
      activeCharacterIdRef.current = nextActiveCharacter?.id ?? null;
      setSheet(loadedSheet);
    }

    async function requestNextNotification() {
      if (
        cancelled ||
        inFlight ||
        pollingPausedRef.current ||
        activeNotificationRef.current
      ) {
        return;
      }

      inFlight = true;
      clearPollTimer();

      try {
        const response = await fetch(
          `${baseUrl}/notifications/${encodeURIComponent(username)}`
        );

        if (response.status === 403) {
          await handleEliminated();
          return;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: NotificationResponse = await response.json();

        if (cancelled) return;

        setConnected(true);
        setError(null);

        const notification = extractNotification(data, username);

        if (!notification) {
          scheduleNextPoll();
          return;
        }

        activeNotificationRef.current = notification;

        if (notification.kind === "media" && notification.resource) {
          addResourceToSession(notification.resource);
          const key = getMediaNotificationKey(notification, notification.resource);

          if (dismissedMediaKeyRef.current === key) {
            await acknowledgeNotification(notification);
          } else {
            setMediaResource(notification.resource);
            setMediaVisible(true);
          }
          return;
        }

        if (notification.kind === "countdown" && notification.countdown) {
          setCountdown(notification.countdown);
          const key = getCountdownKey(notification.countdown);

          if (minimizedCountdownKeyRef.current !== key) {
            setCountdownVisible(true);
          }
          void acknowledgeNotification(notification);
          return;
        }

        if (notification.kind === "countdownCancel") {
          minimizedCountdownKeyRef.current = null;
          setCountdownVisible(false);
          setCountdown(null);
          await acknowledgeNotification(notification);
          return;
        }

        if (notification.kind === "templateUpdate") {
          await loadInitialState();
          await acknowledgeNotification(notification);
          return;
        }

        if (notification.kind === "sheetUpdate") {
          if (
            notification.characterId &&
            activeCharacterIdRef.current &&
            notification.characterId !== activeCharacterIdRef.current
          ) {
            setCharacters((current) => current.map((character) => (
              character.id === notification.characterId
                ? { ...character, sheet: notification.sheet || character.sheet }
                : character
            )));
          } else if (notification.sheet) {
            setSheet(notification.sheet);
            if (notification.characterId) {
              setCharacters((current) => current.map((character) => (
                character.id === notification.characterId
                  ? { ...character, sheet: notification.sheet || character.sheet }
                  : character
              )));
            }
          } else {
            await loadInitialState();
          }
          await acknowledgeNotification(notification);
          return;
        }

        if (notification.kind === "elimination") {
          activeNotificationRef.current = null;
          await acknowledgeNotification(notification);
          await handleEliminated();
          return;
        }

        activeNotificationRef.current = null;
        scheduleNextPoll(0);
      } catch (err) {
        console.log("[HTTP] Error consultando notificaciones:", err);
        setConnected(false);
        scheduleNextPoll();
      } finally {
        inFlight = false;
      }
    }

    async function startPolling() {
      try {
        baseUrl = await getStoredEvaHttpBaseUrl();

        console.log("[HTTP] Consultando a", baseUrl);

        await loadInitialState();

        if (cancelled) return;

        setConnected(true);
        setError(null);
        setLoading(false);
        scheduleNextPoll(0);
      } catch (err) {
        console.log("[HTTP] Error cargando estado de EVA:", err);

        if (cancelled) return;

        setConnected(false);
        setError("No se pudo consultar a EVA.");
        setLoading(false);
      }
    }

    requestNextNotificationRef.current = requestNextNotification;
    setLoading(true);
    setError(null);
    activeNotificationRef.current = null;
    startPolling();

    return () => {
      cancelled = true;
      clearPollTimer();
      requestNextNotificationRef.current = null;
    };
  }, [username, retryKey]);

  async function acknowledgeNotification(notification: ActiveNotification | null) {
    activeNotificationRef.current = null;

    if (notification?.id === null || notification?.id === undefined) {
      requestNextNotificationRef.current?.();
      return;
    }

    try {
      const baseUrl = await getStoredEvaHttpBaseUrl();

      const response = await fetch(
        `${baseUrl}/notifications/${encodeURIComponent(username)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: notification.id }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setConnected(true);
      setError(null);
    } catch (err) {
      console.log("[HTTP] Error marcando notificación como leída:", err);
      setConnected(false);
    } finally {
      requestNextNotificationRef.current?.();
    }
  }

  async function handleEliminated() {
    activeNotificationRef.current = null;
    setMediaVisible(false);
    setCountdownVisible(false);
    setMediaResource(null);
    setCountdown(null);
    await onLogout();
  }

  function addResourceToSession(resource: MediaResource) {
    const key = getResourceKey(resource);

    setResourceHistory((prev) => {
      const withoutDuplicate = prev.filter((item) => item.key !== key);

      return [
        {
          key,
          resource,
          receivedAt: new Date(),
        },
        ...withoutDuplicate,
      ];
    });
  }

  function openSessionResource(resource: MediaResource) {
    setMediaResource(resource);
    setMediaVisible(true);
  }

  function selectCharacter(character: PlayerCharacter) {
    setActiveCharacterId(character.id);
    activeCharacterIdRef.current = character.id;
    setSheet(character.sheet);
    setActiveSheetTab(GENERIC_TAB_KEY);
  }

  async function updateSheetFieldValue(field: CharacterSheetField, nextValue: CharacterSheetField["value"]) {
    let optimisticSheet: CharacterSheet | null = null;

    setSheet((current) => {
      if (!current) return current;

      optimisticSheet = {
        ...current,
        fields: current.fields.map((candidate) => (
          candidate.key === field.key ? { ...candidate, value: nextValue } : candidate
        )),
      };
      return optimisticSheet;
    });

    if (activeCharacterId && optimisticSheet) {
      setCharacters((current) => current.map((character) => (
        character.id === activeCharacterId
          ? { ...character, sheet: optimisticSheet }
          : character
      )));
    }

    try {
      const baseUrl = await getStoredEvaHttpBaseUrl();
      const endpoint = activeCharacterId
        ? `${baseUrl}/api/characters/by-id/${encodeURIComponent(String(activeCharacterId))}/sheet`
        : `${baseUrl}/api/characters/${encodeURIComponent(username)}/sheet`;
      const response = await fetch(
        endpoint,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fields: { [field.key]: nextValue } }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

    } catch (err) {
      console.log("[HTTP] Error actualizando ficha:", err);
      setRetryKey((prev) => prev + 1);
    }
  }

  async function updateSheetField(field: CharacterSheetField, delta: number) {
    const currentValue = Array.isArray(field.value) ? "0" : field.value;
    const nextValue = String(parseInt(currentValue || "0", 10) + delta);
    await updateSheetFieldValue(field, nextValue);
  }

  function updateSheetFieldLocal(fieldKey: string, nextValue: CharacterSheetField["value"]) {
    setSheet((current) => {
      if (!current) return current;

      return {
        ...current,
        fields: current.fields.map((candidate) => (
          candidate.key === fieldKey ? { ...candidate, value: nextValue } : candidate
        )),
      };
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <DreadBackdrop dreadAnim={dreadAnim} />
        <LoadingCard username={username} fadeAnim={fadeAnim} pulseAnim={pulseAnim} />

        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <DreadBackdrop dreadAnim={dreadAnim} />
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <AppHeader username={username} connected={connected} />

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>La señal se ha roto</Text>
            <Text style={styles.errorText}>{error}</Text>

            <Pressable
              style={styles.retryButton}
              onPress={() => {
                setRetryKey((prev) => prev + 1);
              }}
            >
              <Text style={styles.retryText}>VOLVER A LLAMAR</Text>
            </Pressable>
          </View>
        ) : (
          <CharacterSheetPanel
            username={username}
            sheet={sheet}
            activeCharacter={activeCharacter}
            characters={characters}
            activeCharacterId={activeCharacterId}
            activeDrawer={activeDrawer}
            activeDynamicTab={activeDynamicTab}
            dynamicPages={dynamicPages}
            sheetDrawerAnim={sheetDrawerAnim}
            diceDrawerAnim={diceDrawerAnim}
            filesDrawerAnim={filesDrawerAnim}
            resourceHistory={resourceHistory}
            onSelectCharacter={selectCharacter}
            onSetActiveSheetTab={setActiveSheetTab}
            onToggleDrawer={(drawer) => {
              setActiveDrawer((current) => (current === drawer ? null : drawer));
            }}
            onOpenResource={openSessionResource}
            onUpdateField={updateSheetFieldValue}
            onUpdateFieldDelta={updateSheetField}
            onUpdateFieldLocal={updateSheetFieldLocal}
          />
        )}
      </Animated.View>

      <MediaResourceModal
        visible={mediaVisible}
        resource={mediaResource}
        onClose={() => {
          const notification = activeNotificationRef.current;
          if (mediaResource) {
            dismissedMediaKeyRef.current = getMediaNotificationKey(notification, mediaResource);
          }
          activeNotificationRef.current = null;
          setMediaVisible(false);
          setMediaResource(null);
          void acknowledgeNotification(notification);
        }}
      />
      <CountdownModal
        visible={countdownVisible}
        countdown={countdown}
        onMinimize={() => {
          const notification = activeNotificationRef.current;
          if (countdown) {
            minimizedCountdownKeyRef.current = getCountdownKey(countdown);
          }
          setCountdownVisible(false);
          void acknowledgeNotification(notification);
        }}
      />
      {countdown && !countdownVisible ? (
        <Pressable
          style={styles.countdownMini}
          onPress={() => {
            minimizedCountdownKeyRef.current = null;
            setCountdownVisible(true);
          }}
        >
          <Text style={styles.countdownMiniText}>{countdown.label || "Temporizador"}</Text>
        </Pressable>
      ) : null}

      <StatusBar style="light" />
    </SafeAreaView>
  );
}
