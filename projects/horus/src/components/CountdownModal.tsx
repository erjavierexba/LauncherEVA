import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HORUS_THEME } from "../theme/theme";

const { colors, spacing, radius, fontSize, shadow } = HORUS_THEME;

const SEGMENTS_BY_CHARACTER: Record<string, string[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "g", "c", "d"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "c", "d"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
};

export type CountdownData = {
  targetAt: string;
  durationSeconds?: number;
  label?: string;
};

type Props = {
  visible: boolean;
  countdown: CountdownData | null;
  onMinimize: () => void;
};

export default function CountdownModal({ visible, countdown, onMinimize }: Props) {
  const [now, setNow] = useState(Date.now());
  const alarmPulse = useRef(new Animated.Value(0)).current;

  const targetTime = useMemo(() => {
    if (!countdown) return 0;

    const parsed = Date.parse(countdown.targetAt);

    return Number.isNaN(parsed) ? 0 : parsed;
  }, [countdown?.targetAt]);

  const remainingMs = Math.max(0, targetTime - now);
  const totalMs = Math.max((countdown?.durationSeconds ?? 0) * 1000, 1);
  const progress = Math.max(0, Math.min(1, remainingMs / totalMs));
  const expired = remainingMs <= 0;

  useEffect(() => {
    if (!visible) return;

    setNow(Date.now());

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 100);

    return () => clearInterval(interval);
  }, [visible, targetTime]);

  useEffect(() => {
    if (!visible) {
      alarmPulse.stopAnimation();
      alarmPulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(alarmPulse, {
          toValue: 1,
          duration: 950,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(alarmPulse, {
          toValue: 0,
          duration: 1150,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [visible, alarmPulse]);

  if (!countdown) return null;

  const { minutes, seconds, tenths } = splitRemainingTime(remainingMs);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <SafeAreaView style={styles.backdrop}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.alarmWash,
            {
              opacity: alarmPulse.interpolate({
                inputRange: [0, 1],
                outputRange: expired ? [0.08, 0.14] : [0.12, 0.32],
              }),
            },
          ]}
        />
        <View style={styles.panel}>
          <View style={styles.alertHeader}>
            <View style={styles.alertRail} />
            <Text style={styles.kicker}>
              {expired ? "PROTOCOLO CERRADO" : "CÓDIGO ROJO · SINCRONIZACIÓN"}
            </Text>
            <View style={styles.alertRail} />
          </View>
          <Text style={styles.title}>{countdown.label || "Temporizador"}</Text>

          <View style={[styles.displayShell, expired && styles.displayShellExpired]}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.innerAlarmGlow,
                {
                  opacity: alarmPulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: expired ? [0.05, 0.1] : [0.08, 0.24],
                  }),
                },
              ]}
            />
            <View style={styles.warningStripeTop} />
            <View style={styles.timerBox}>
              <SevenSegmentDigit value={formatTwoDigits(minutes)[0]} expired={expired} />
              <SevenSegmentDigit value={formatTwoDigits(minutes)[1]} expired={expired} />
              <SevenSegmentColon expired={expired} />
              <SevenSegmentDigit value={formatTwoDigits(seconds)[0]} expired={expired} />
              <SevenSegmentDigit value={formatTwoDigits(seconds)[1]} expired={expired} />
              <SevenSegmentDecimal expired={expired} />
              <SevenSegmentDigit value={String(tenths)} small expired={expired} />
            </View>
            <View style={styles.warningStripeBottom} />
          </View>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>

          <Text style={styles.status}>
            {expired ? "TIEMPO AGOTADO" : "ALARMA SILENCIOSA ACTIVA"}
          </Text>

          <Pressable style={styles.button} onPress={onMinimize}>
            <Text style={styles.buttonText}>MINIMIZAR</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function splitRemainingTime(remainingMs: number) {
  const totalTenths = Math.ceil(remainingMs / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;

  return { minutes, seconds, tenths };
}

function formatTwoDigits(value: number) {
  return String(value).padStart(2, "0");
}

function SevenSegmentDigit({
  value,
  small = false,
  expired,
}: {
  value: string;
  small?: boolean;
  expired: boolean;
}) {
  const activeSegments = SEGMENTS_BY_CHARACTER[value] ?? [];

  return (
    <View style={[styles.digit, small && styles.digitSmall]}>
      {["a", "b", "c", "d", "e", "f", "g"].map((segment) => (
        <View
          key={segment}
          style={[
            styles.segment,
            styles[`segment${segment.toUpperCase()}` as SegmentStyleKey],
            small && styles.segmentSmall,
            activeSegments.includes(segment)
              ? expired
                ? styles.segmentActiveExpired
                : styles.segmentActive
              : styles.segmentInactive,
          ]}
        />
      ))}
    </View>
  );
}

function SevenSegmentColon({ expired }: { expired: boolean }) {
  return (
    <View style={styles.colon}>
      <View style={[styles.dot, expired ? styles.segmentActiveExpired : styles.segmentActive]} />
      <View style={[styles.dot, expired ? styles.segmentActiveExpired : styles.segmentActive]} />
    </View>
  );
}

function SevenSegmentDecimal({ expired }: { expired: boolean }) {
  return (
    <View style={styles.decimal}>
      <View style={[styles.dot, expired ? styles.segmentActiveExpired : styles.segmentActive]} />
    </View>
  );
}

type SegmentStyleKey =
  | "segmentA"
  | "segmentB"
  | "segmentC"
  | "segmentD"
  | "segmentE"
  | "segmentF"
  | "segmentG";

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  alarmWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#B00012",
  },

  panel: {
    width: "100%",
    backgroundColor: "rgba(8, 9, 11, 0.98)",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(255,48,48,0.52)",
    padding: spacing.xl,
    alignItems: "center",
    ...shadow.panel,
    shadowColor: "#FF3030",
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },

  alertHeader: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },

  alertRail: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(255,48,48,0.55)",
    borderRadius: 999,
  },

  kicker: {
    color: "#FF5B5B",
    fontSize: fontSize.xs,
    fontWeight: "900",
    letterSpacing: 1.6,
    textAlign: "center",
  },

  title: {
    color: colors.textLight,
    fontSize: fontSize.lg,
    fontWeight: "900",
    marginTop: spacing.sm,
    textAlign: "center",
  },

  displayShell: {
    width: "100%",
    backgroundColor: "#050405",
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: "rgba(255,48,48,0.55)",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xl,
    shadowColor: "#FF3030",
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
    overflow: "hidden",
  },

  displayShellExpired: {
    borderColor: colors.action,
  },

  innerAlarmGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FF3030",
  },

  warningStripeTop: {
    position: "absolute",
    top: 10,
    left: spacing.md,
    right: spacing.md,
    height: 1,
    backgroundColor: "rgba(255,48,48,0.36)",
  },

  warningStripeBottom: {
    position: "absolute",
    bottom: 10,
    left: spacing.md,
    right: spacing.md,
    height: 1,
    backgroundColor: "rgba(201,162,74,0.28)",
  },

  timerBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  digit: {
    width: 42,
    height: 78,
    position: "relative",
  },

  digitSmall: {
    width: 30,
    height: 56,
    marginLeft: 1,
  },

  segment: {
    position: "absolute",
    borderRadius: 999,
  },

  segmentSmall: {
    borderRadius: 999,
  },

  segmentActive: {
    backgroundColor: "#FF3030",
    shadowColor: "#FF3030",
    shadowOpacity: 0.95,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },

  segmentActiveExpired: {
    backgroundColor: "#C9A24A",
    shadowColor: "#C9A24A",
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },

  segmentInactive: {
    backgroundColor: "rgba(255,48,48,0.08)",
  },

  segmentA: {
    top: 0,
    left: 8,
    right: 8,
    height: 8,
  },

  segmentB: {
    top: 7,
    right: 0,
    width: 8,
    height: 29,
  },

  segmentC: {
    bottom: 7,
    right: 0,
    width: 8,
    height: 29,
  },

  segmentD: {
    bottom: 0,
    left: 8,
    right: 8,
    height: 8,
  },

  segmentE: {
    bottom: 7,
    left: 0,
    width: 8,
    height: 29,
  },

  segmentF: {
    top: 7,
    left: 0,
    width: 8,
    height: 29,
  },

  segmentG: {
    top: 35,
    left: 8,
    right: 8,
    height: 8,
  },

  colon: {
    width: 12,
    height: 78,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },

  decimal: {
    width: 10,
    height: 78,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 6,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },

  track: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#17090A",
    borderWidth: 1,
    borderColor: "rgba(255,48,48,0.45)",
    marginTop: spacing.xl,
  },

  fill: {
    height: "100%",
    backgroundColor: "#FF3030",
  },

  status: {
    color: "#FF8A8A",
    fontSize: fontSize.sm,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: spacing.md,
  },

  button: {
    backgroundColor: "#2B090B",
    borderWidth: 1,
    borderColor: "rgba(201,162,74,0.8)",
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },

  buttonText: {
    color: colors.textLight,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
