import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Markdown from "react-native-markdown-display";
import { Audio, ResizeMode, Video } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";

import { HORUS_THEME } from "../theme/theme";
import { APP_BRAND } from "../config/brand";

const { colors, spacing, radius, fontSize } = HORUS_THEME;

export type MediaResource = {
  tipo: "TEXTO" | "IMAGEN" | "AUDIO" | "VIDEO" | "DOCUMENTO";
  nombre: string;
  url: string;
  mime?: string;
  baseUrl?: string;
};

type Props = {
  visible: boolean;
  resource: MediaResource | null;
  onClose: () => void;
};

export default function MediaResourceModal({
  visible,
  resource,
  onClose,
}: Props) {
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadBytes, setDownloadBytes] = useState({ written: 0, total: 0 });
  const [localUri, setLocalUri] = useState("");
  const [error, setError] = useState("");
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);

  const pulse = useRef(new Animated.Value(1)).current;
  const soundRef = useRef<Audio.Sound | null>(null);
  const videoRef = useRef<Video | null>(null);
  const downloadRef = useRef<FileSystem.DownloadResumable | null>(null);

  const absoluteUrl = getAbsoluteUrl(resource);
  useEffect(() => {
    if (!visible) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [visible]);

  useEffect(() => {
    if (!visible || !resource) return;

    let cancelled = false;

    setError("");
    setMarkdown("");
    setLocalUri("");
    setDownloadProgress(0);
    setDownloadBytes({ written: 0, total: 0 });
    setAudioPlaying(false);
    setVideoPlaying(false);

    prepareResource(resource)
      .then(async (prepared) => {
        if (cancelled) return;

        setLocalUri(prepared.uri);

        if (prepared.markdown !== undefined) {
          setMarkdown(prepared.markdown);
        }

        if (resource.tipo === "AUDIO") {
          await playAudio(prepared.uri);
        }
      })
      .catch((err) => {
        if (cancelled) return;

        console.log("ERROR MEDIA RESOURCE:", err);
        setError("No se pudo cargar el recurso.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      downloadRef.current?.cancelAsync().catch(() => {});
      downloadRef.current = null;
      stopAudio();
      videoRef.current?.stopAsync?.().catch(() => {});
    };
  }, [visible, resource?.url, resource?.baseUrl]);

  async function prepareResource(resourceToPrepare: MediaResource) {
    setLoading(true);

    const uri = await downloadResource(resourceToPrepare);

    if (resourceToPrepare.tipo !== "TEXTO") {
      return { uri };
    }

    const raw = await FileSystem.readAsStringAsync(uri);
    const fixed = absolutizeMarkdownImages(raw, resourceToPrepare.baseUrl);

    return { uri, markdown: fixed };
  }

  async function downloadResource(resourceToDownload: MediaResource) {
    const remoteUri = getAbsoluteUrl(resourceToDownload);
    const fileUri = getCachedFileUri(resourceToDownload, remoteUri);
    const info = await FileSystem.getInfoAsync(fileUri);

    if (info.exists) {
      const size = "size" in info && typeof info.size === "number" ? info.size : 0;

      setDownloadProgress(1);
      setDownloadBytes({ written: size, total: size });

      return fileUri;
    }

    const resumable = FileSystem.createDownloadResumable(
      remoteUri,
      fileUri,
      {},
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        const total = Math.max(totalBytesExpectedToWrite, 0);
        const progress = total > 0 ? Math.min(totalBytesWritten / total, 1) : 0;

        setDownloadProgress(progress);
        setDownloadBytes({
          written: totalBytesWritten,
          total,
        });
      }
    );

    downloadRef.current = resumable;
    const result = await resumable.downloadAsync();
    downloadRef.current = null;

    if (!result) {
      throw new Error("Descarga cancelada.");
    }

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`HTTP ${result.status}`);
    }

    setDownloadProgress(1);

    return result.uri;
  }

  async function toggleAudio() {
    const sound = soundRef.current;

    if (!sound) {
      await playAudio(localUri || absoluteUrl);
      return;
    }

    const status = await sound.getStatusAsync();

    if (!status.isLoaded) return;

    if (status.isPlaying) {
      await sound.pauseAsync();
      setAudioPlaying(false);
    } else {
      await sound.playAsync();
      setAudioPlaying(true);
    }
  }



  async function playAudio(uri: string) {
    if (!resource || !uri) return;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        {
          shouldPlay: true,
          volume: 1,
          isLooping: false,
        }
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        setAudioPlaying(status.isPlaying);
      });

      soundRef.current = sound;
      setAudioPlaying(true);
    } catch (err) {
      console.log("ERROR AUDIO RESOURCE:", err);
      setError("No se pudo reproducir el audio.");
    }
  }

  async function stopAudio() {
    const sound = soundRef.current;
    soundRef.current = null;

    if (sound) {
      await sound.stopAsync().catch(() => {});
      await sound.unloadAsync().catch(() => {});
    }
  }

  async function closeModal() {
    onClose();
    await stopAudio();
    downloadRef.current?.cancelAsync().catch(() => {});
    downloadRef.current = null;
    videoRef.current?.stopAsync?.().catch(() => {});
  }

  if (!resource) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <SafeAreaView style={styles.container}>
        <Pressable style={styles.closeButton} onPress={closeModal}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.kicker}>ARCHIVO RECIBIDO</Text>
          <Text style={styles.title}>{resource.nombre}</Text>
        </View>

        <View style={styles.content}>
          {loading ? (
            renderLoading()
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            renderResource()
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
  async function restartAudio() {
    const sound = soundRef.current;

    if (!sound) {
      await playAudio(localUri || absoluteUrl);
      return;
    }

    await sound.setPositionAsync(0);
    await sound.playAsync();
    setAudioPlaying(true);
  }
  function renderResource() {
    if (!resource) return null;

    if (resource.tipo === "TEXTO") {
      return (
        <ScrollView style={styles.markdownScroll}>
          <Markdown style={markdownStyles}>{markdown}</Markdown>
        </ScrollView>
      );
    }

    if (resource.tipo === "IMAGEN") {
      return (
        <View style={styles.centerBox}>
          <Image
            source={{ uri: localUri || absoluteUrl }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      );
    }

    if (resource.tipo === "AUDIO") {
      return (
        <View style={styles.audioShell}>
          <Text style={styles.horusStamp}>𓂀 {APP_BRAND.audioFeedLabel}</Text>

          <Animated.View
            style={[
              styles.audioOrb,
              {
                transform: [{ scale: audioPlaying ? pulse : 1 }],
              },
            ]}
          >
            <Text style={styles.audioOrbIcon}>♪</Text>
          </Animated.View>

          <Text style={styles.audioTitle}>{resource.nombre}</Text>
          <Text style={styles.audioStatus}>
            {audioPlaying ? "REPRODUCIENDO SEÑAL" : "SEÑAL EN PAUSA"}
          </Text>

          <View style={styles.audioBars}>
            {Array.from({ length: 18 }).map((_, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.audioBar,
                  {
                    height: audioPlaying ? 18 + ((index * 7) % 28) : 10,
                    opacity: audioPlaying ? 0.9 : 0.35,
                  },
                ]}
              />
            ))}
          </View>

          <View style={styles.mediaActions}>
            <Pressable style={styles.primaryMediaButton} onPress={toggleAudio}>
              <Text style={styles.primaryMediaButtonText}>
                {audioPlaying ? "PAUSAR" : "REPRODUCIR"}
              </Text>
            </Pressable>

            <Pressable style={styles.secondaryMediaButton} onPress={restartAudio}>
              <Text style={styles.secondaryMediaButtonText}>REINICIAR</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (resource.tipo === "VIDEO") {
      return (
        <View style={styles.videoShell}>
          <View style={styles.videoHeader}>
            <Text style={styles.horusStamp}>𓂀 {APP_BRAND.videoFeedLabel}</Text>
            <Text style={styles.videoTitle}>{resource.nombre}</Text>
          </View>

          <View style={styles.videoFrame}>
            <Video
              ref={(ref) => {
                videoRef.current = ref;
              }}
              source={{ uri: localUri || absoluteUrl }}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              useNativeControls={false}
              onPlaybackStatusUpdate={(status) => {
                if (!status.isLoaded) return;
                setVideoPlaying(status.isPlaying);
              }}
            />

            <View pointerEvents="none" style={styles.videoOverlay}>
              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
            </View>
          </View>

          <View style={styles.mediaActions}>
            <Pressable
              style={styles.primaryMediaButton}
              onPress={async () => {
                const video = videoRef.current;
                if (!video) return;

                const status = await video.getStatusAsync();
                if (!status.isLoaded) return;

                if (status.isPlaying) {
                  await video.pauseAsync();
                  setVideoPlaying(false);
                } else {
                  await video.playAsync();
                  setVideoPlaying(true);
                }
              }}
            >
              <Text style={styles.primaryMediaButtonText}>
                {videoPlaying ? "PAUSAR" : "REPRODUCIR"}
              </Text>
            </Pressable>

            <Pressable
              style={styles.secondaryMediaButton}
              onPress={async () => {
                const video = videoRef.current;
                if (!video) return;

                await video.setPositionAsync(0);
                await video.playAsync();
                setVideoPlaying(true);
              }}
            >
              <Text style={styles.secondaryMediaButtonText}>REINICIAR</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (resource.tipo === "DOCUMENTO") {
      return (
        <View style={styles.centerBox}>
          <Text style={styles.bigIcon}>PDF</Text>
          <Text style={styles.audioText}>{resource.nombre}</Text>
          <Text style={styles.progressText}>Documento descargado en la cache del dispositivo.</Text>
        </View>
      );
    }

    return null;
  }

  function renderLoading() {
    const hasTotal = downloadBytes.total > 0;
    const percent = hasTotal ? Math.round(downloadProgress * 100) : null;

    return (
      <View style={styles.centerBox}>
        <ActivityIndicator color={colors.premium} size="large" />
        <Text style={styles.loadingText}>Descargando recurso...</Text>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${hasTotal ? Math.max(percent ?? 0, 4) : 28}%`,
              },
            ]}
          />
        </View>

        <Text style={styles.progressText}>
          {hasTotal
            ? `${percent}% · ${formatBytes(downloadBytes.written)} / ${formatBytes(
                downloadBytes.total
              )}`
            : `${formatBytes(downloadBytes.written)} descargados`}
        </Text>
      </View>
    );
  }
}

function getAbsoluteUrl(resource: MediaResource | null) {
  if (!resource) return "";

  if (resource.url.startsWith("http://") || resource.url.startsWith("https://")) {
    return resource.url;
  }

  if (!resource.baseUrl) {
    return resource.url;
  }

  return `${resource.baseUrl}${resource.url}`;
}

function absolutizeMarkdownImages(markdown: string, baseUrl?: string) {
  if (!baseUrl) return markdown;

  return markdown.replace(
    /!\[([^\]]*)\]\((\/media\/[^)]+)\)/g,
    `![$1](${baseUrl}$2)`
  );
}

function getCachedFileUri(resource: MediaResource, remoteUri: string) {
  const cacheDirectory = FileSystem.cacheDirectory;

  if (!cacheDirectory) {
    throw new Error("Cache directory no disponible.");
  }

  const extension = getResourceExtension(resource, remoteUri);
  const fingerprint = hashString(`${resource.tipo}:${resource.nombre}:${remoteUri}`);

  return `${cacheDirectory}horus-${fingerprint}${extension}`;
}

function getResourceExtension(resource: MediaResource, remoteUri: string) {
  const cleanUri = remoteUri.split("?")[0];
  const match = cleanUri.match(/\.[a-z0-9]+$/i);

  if (match) return match[0].toLowerCase();

  if (resource.tipo === "TEXTO") return ".md";
  if (resource.tipo === "IMAGEN") return ".png";
  if (resource.tipo === "AUDIO") return ".ogg";
  if (resource.tipo === "VIDEO") return ".mp4";
  if (resource.tipo === "DOCUMENTO") return ".pdf";

  return ".bin";
}

function hashString(value: string) {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(16);
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** exponent;

  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${
    units[exponent]
  }`;
}

const markdownStyles = {
  body: {
    color: colors.textLight,
    fontSize: 16,
    lineHeight: 24,
  },

  heading1: {
    color: colors.premium,
    fontSize: 30,
    fontWeight: "900" as const,
    marginBottom: 14,
  },

  heading2: {
    color: colors.textLight,
    fontSize: 24,
    fontWeight: "900" as const,
    marginTop: 18,
    marginBottom: 10,
  },

  heading3: {
    color: colors.textLight,
    fontSize: 20,
    fontWeight: "800" as const,
    marginTop: 14,
    marginBottom: 8,
  },

  paragraph: {
    color: colors.textLight,
    marginBottom: 12,
  },

  strong: {
    color: colors.premium,
    fontWeight: "900" as const,
  },

  em: {
    fontStyle: "italic" as const,
  },

  bullet_list: {
    marginBottom: 12,
  },

  ordered_list: {
    marginBottom: 12,
  },

  list_item: {
    marginBottom: 8,
  },

  code_inline: {
    backgroundColor: colors.border.dark,
    color: colors.premium,
    borderRadius: 4,
    paddingHorizontal: 4,
  },

  fence: {
    backgroundColor: "#050608",
    color: colors.textLight,
    borderRadius: 10,
    padding: 12,
    marginVertical: 12,
  },

  blockquote: {
    backgroundColor: "rgba(201, 162, 74, 0.12)",
    borderLeftWidth: 4,
    borderLeftColor: colors.premium,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 12,
  },

  hr: {
    backgroundColor: colors.border.gold,
    height: 1,
    marginVertical: 18,
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 54,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  closeButton: {
    position: "absolute",
    top: 42,
    right: spacing.lg,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "rgba(139, 30, 30, 0.9)",
    borderWidth: 1,
    borderColor: colors.premium,
    alignItems: "center",
    justifyContent: "center",
  },

  closeText: {
    color: colors.textLight,
    fontSize: 34,
    lineHeight: 36,
    fontWeight: "700",
  },

  header: {
    paddingRight: 52,
    marginBottom: spacing.lg,
  },

  kicker: {
    color: colors.premium,
    fontSize: fontSize.xs,
    fontWeight: "900",
    letterSpacing: 3,
  },

  title: {
    color: colors.textLight,
    fontSize: fontSize.xl,
    fontWeight: "900",
    marginTop: spacing.xs,
  },

  content: {
    flex: 1,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.gold,
    backgroundColor: "rgba(38, 42, 48, 0.72)",
    overflow: "hidden",
  },

  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },

  loadingText: {
    color: colors.textLight,
    marginTop: spacing.md,
    fontWeight: "700",
  },

  progressTrack: {
    width: "82%",
    height: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(201,162,74,0.35)",
  },

  progressFill: {
    height: "100%",
    backgroundColor: colors.premium,
    borderRadius: 999,
  },

  progressText: {
    color: colors.neutral.stone,
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
    fontWeight: "800",
  },

  errorText: {
    color: colors.action,
    fontSize: fontSize.md,
    fontWeight: "900",
    textAlign: "center",
  },

  markdownScroll: {
    flex: 1,
    padding: spacing.lg,
  },

  image: {
    width: "100%",
    height: "100%",
  }, 

  bigIcon: {
    color: colors.premium,
    fontSize: 72,
    fontWeight: "900",
  },

  audioText: {
    color: colors.textLight,
    fontSize: fontSize.lg,
    fontWeight: "800",
    marginTop: spacing.md,
  },

  secondaryButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.action,
    borderWidth: 1,
    borderColor: colors.premium,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },

  secondaryButtonText: {
    color: colors.textLight,
    fontWeight: "900",
    letterSpacing: 1,
  },

  horusStamp: {
  color: colors.premium,
  fontSize: fontSize.xs,
  fontWeight: "900",
  letterSpacing: 2,
  textAlign: "center",
},

audioShell: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  padding: spacing.xl,
  backgroundColor: "rgba(13,15,18,0.92)",
},

audioOrb: {
  width: 128,
  height: 128,
  borderRadius: 999,
  borderWidth: 2,
  borderColor: colors.premium,
  backgroundColor: "rgba(201,162,74,0.12)",
  alignItems: "center",
  justifyContent: "center",
  marginTop: spacing.xl,
  shadowColor: colors.premium,
  shadowOpacity: 0.8,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 0 },
  elevation: 10,
},

audioOrbIcon: {
  color: colors.premium,
  fontSize: 58,
  fontWeight: "900",
},

audioTitle: {
  color: colors.textLight,
  fontSize: fontSize.lg,
  fontWeight: "900",
  marginTop: spacing.xl,
  textAlign: "center",
},

audioStatus: {
  color: colors.neutral.stone,
  fontSize: fontSize.sm,
  fontWeight: "800",
  marginTop: spacing.sm,
  letterSpacing: 1,
},

audioBars: {
  height: 56,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  marginTop: spacing.xl,
},

audioBar: {
  width: 5,
  borderRadius: 999,
  backgroundColor: colors.premium,
},

mediaActions: {
  flexDirection: "row",
  justifyContent: 'space-between',
  gap: spacing.md,
  marginTop: spacing.xl,
},

primaryMediaButton: {
  backgroundColor: colors.action,
  borderWidth: 1,
  borderColor: colors.premium,
  borderRadius: radius.md,
  paddingVertical: spacing.md,
  paddingHorizontal: spacing.xl,
},

primaryMediaButtonText: {
  color: colors.textLight,
  fontWeight: "900",
  letterSpacing: 1,
},

secondaryMediaButton: {
  backgroundColor: "rgba(38,42,48,0.95)",
  borderWidth: 1,
  borderColor: colors.border.gold,
  borderRadius: radius.md,
  paddingVertical: spacing.md,
  paddingHorizontal: spacing.lg,
},

secondaryMediaButtonText: {
  color: colors.premium,
  fontWeight: "900",
  letterSpacing: 1,
},

videoShell: {
  flex: 1,
  justifyContent: "center",
  padding: spacing.md,
  backgroundColor: "rgba(13,15,18,0.96)",
},

videoHeader: {
  marginBottom: spacing.md,
},

videoTitle: {
  color: colors.textLight,
  fontSize: fontSize.lg,
  fontWeight: "900",
  textAlign: "center",
  marginTop: spacing.xs,
},

videoFrame: {
  width: "100%",
  aspectRatio: 16 / 9,
  backgroundColor: "#000",
  borderWidth: 1,
  borderColor: colors.premium,
  borderRadius: radius.lg,
  overflow: "hidden",
  shadowColor: colors.premium,
  shadowOpacity: 0.45,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 0 },
  elevation: 8,
},

video: {
  width: "100%",
  height: "100%",
},

videoOverlay: {
  ...StyleSheet.absoluteFillObject,
  borderWidth: 1,
  borderColor: "rgba(201,162,74,0.35)",
},

cornerTopLeft: {
  position: "absolute",
  top: 8,
  left: 8,
  width: 28,
  height: 28,
  borderTopWidth: 2,
  borderLeftWidth: 2,
  borderColor: colors.premium,
},

cornerTopRight: {
  position: "absolute",
  top: 8,
  right: 8,
  width: 28,
  height: 28,
  borderTopWidth: 2,
  borderRightWidth: 2,
  borderColor: colors.premium,
},

cornerBottomLeft: {
  position: "absolute",
  bottom: 8,
  left: 8,
  width: 28,
  height: 28,
  borderBottomWidth: 2,
  borderLeftWidth: 2,
  borderColor: colors.premium,
},

cornerBottomRight: {
  position: "absolute",
  bottom: 8,
  right: 8,
  width: 28,
  height: 28,
  borderBottomWidth: 2,
  borderRightWidth: 2,
  borderColor: colors.premium,
},
});
