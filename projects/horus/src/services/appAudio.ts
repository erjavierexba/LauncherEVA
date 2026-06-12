import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio, type AVPlaybackSource } from "expo-av";

const APP_VOLUME_STORAGE_KEY = "horus_app_volume";
const DEFAULT_VOLUME = 0.45;
const activeSounds = new Set<Audio.Sound>();

export type OptionalAudioAsset = AVPlaybackSource | null;

export async function getAppVolume() {
  const stored = await AsyncStorage.getItem(APP_VOLUME_STORAGE_KEY);
  const parsed = stored === null ? Number.NaN : Number(stored);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_VOLUME;
  }

  return clampVolume(parsed);
}

export async function setAppVolume(nextVolume: number) {
  const volume = clampVolume(nextVolume);
  await AsyncStorage.setItem(APP_VOLUME_STORAGE_KEY, String(volume));

  await Promise.all(
    [...activeSounds].map((sound) => sound.setVolumeAsync(volume).catch(() => {}))
  );

  return volume;
}

export async function playLoopingAudio(asset: OptionalAudioAsset) {
  if (!asset) return null;

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    staysActiveInBackground: false,
  });

  const volume = await getAppVolume();
  const { sound } = await Audio.Sound.createAsync(asset, {
    isLooping: true,
    volume,
    shouldPlay: true,
  });

  activeSounds.add(sound);
  return sound;
}

export async function stopLoopingAudio(sound: Audio.Sound | null) {
  if (!sound) return;

  activeSounds.delete(sound);
  await sound.stopAsync().catch(() => {});
  await sound.unloadAsync().catch(() => {});
}

function clampVolume(value: number) {
  return Math.max(0, Math.min(1, value));
}
