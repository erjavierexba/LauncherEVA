import { useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import { getStoredEvaHttpBaseUrl } from "../services/evaServer";
import { HORUS_THEME } from "../theme/theme";
import { CharacterSheetField } from "../types/characterSheet";
import { getDiceFaces } from "../utils/diceRoller";

const { colors, spacing, radius, fontSize } = HORUS_THEME;

type DiceThrowIntegerFieldProps = {
  field: CharacterSheetField;
  username: string;
  characterName: string;
};

export default function DiceThrowIntegerField({
  field,
  username,
  characterName,
}: DiceThrowIntegerFieldProps) {
  const [result, setResult] = useState<{
    natural: number;
    modifier: number;
    total: number;
  } | null>(null);
  const spin = useRef(new Animated.Value(0)).current;
  const faces = getDiceFaces(field.type);
  const modifier = Array.isArray(field.value) ? 0 : parseInt(field.value || "0", 10) || 0;
  const rotation = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  function roll() {
    setResult(null);
    spin.setValue(0);

    Animated.timing(spin, {
      toValue: 1,
      duration: 620,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      const natural = Math.floor(Math.random() * faces) + 1;
      const rollResult = {
        natural,
        modifier,
        total: natural + modifier,
      };
      setResult(rollResult);
      void sendDiceRoll({
        username,
        characterName,
        fieldLabel: field.label,
        dice: `d${faces}`,
        ...rollResult,
      });
    });
  }

  return (
    <View style={styles.diceThrow}>
      <Text style={styles.sheetValue}>{modifier >= 0 ? `+${modifier}` : modifier}</Text>
      <Pressable style={styles.diceRollButton} onPress={roll}>
        <Animated.Text style={[styles.diceRollIcon, { transform: [{ rotate: rotation }] }]}>
          🎲
        </Animated.Text>
      </Pressable>
      {result ? (
        <Text
          style={[
            styles.diceResult,
            result.natural === faces ? styles.diceCritical : null,
            result.natural === 1 ? styles.diceFumble : null,
          ]}
        >
          {result.natural} + {result.modifier} = {result.total}
          {result.natural === faces ? " · crítico!" : result.natural === 1 ? " · pifia!" : ""}
        </Text>
      ) : null}
    </View>
  );
}

async function sendDiceRoll(roll: {
  username: string;
  characterName: string;
  fieldLabel: string;
  dice: string;
  natural: number;
  modifier: number;
  total: number;
}) {
  try {
    const baseUrl = await getStoredEvaHttpBaseUrl();
    await fetch(`${baseUrl}/api/dice-rolls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(roll),
    });
  } catch (err) {
    console.log("[HTTP] Error enviando tirada:", err);
  }
}

const styles = StyleSheet.create({
  diceThrow: {
    gap: spacing.sm,
  },

  sheetValue: {
    color: colors.textLight,
    fontSize: fontSize.lg,
    fontWeight: "900",
  },

  diceRollButton: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.premium,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111012",
  },

  diceRollIcon: {
    fontSize: 22,
  },

  diceResult: {
    color: colors.textLight,
    fontSize: fontSize.sm,
    fontWeight: "900",
  },

  diceCritical: {
    color: "#68D391",
  },

  diceFumble: {
    color: "#FF7B7B",
  },
});
