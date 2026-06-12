import { ActivityIndicator, Animated, Text, View } from "react-native";

import HorusLogo from "./HorusLogo";
import { styles } from "../pages/MainApp.styles";
import { HORUS_THEME } from "../theme/theme";

const { colors } = HORUS_THEME;

type DreadBackdropProps = {
  dreadAnim: Animated.Value;
};

type AppHeaderProps = {
  username: string;
  connected: boolean;
};

type LoadingScreenProps = {
  username: string;
  fadeAnim: Animated.Value;
  pulseAnim: Animated.Value;
};

export function DreadBackdrop({ dreadAnim }: DreadBackdropProps) {
  return (
    <View pointerEvents="none" style={styles.dreadBackdrop}>
      <Animated.View
        style={[
          styles.redVeil,
          {
            opacity: dreadAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.1, 0.28],
            }),
          },
        ]}
      />
      <View style={styles.topScratch} />
      <View style={styles.bottomScratch} />
      <View style={styles.scanLineOne} />
      <View style={styles.scanLineTwo} />
    </View>
  );
}

export function AppHeader({ username, connected }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLogoRow}>
        <HorusLogo size={42} />

        <View>
          <Text style={styles.kicker}>VÍNCULO ACTIVO</Text>
          <Text style={styles.username}>{username}</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: connected
                ? colors.status.success
                : colors.status.danger,
            },
          ]}
        />

        <Text style={styles.statusText}>
          {connected ? "EVA observa" : "El silencio no responde"}
        </Text>
      </View>
    </View>
  );
}

export function LoadingCard({ username, fadeAnim, pulseAnim }: LoadingScreenProps) {
  return (
    <>
      <View style={styles.topLogo}>
        <HorusLogo size={48} />
      </View>

      <Animated.View
        style={[
          styles.loadingCard,
          {
            opacity: fadeAnim,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <ActivityIndicator color={colors.premium} />
        <Text style={styles.loadingText}>Buscando a {username}...</Text>
        <Text style={styles.subText}>EVA está escuchando</Text>
      </Animated.View>
    </>
  );
}
