import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { HORUS_THEME } from "../theme/theme";
import { formatRollBreakdown, DiceRollResult, rollFormula } from "../utils/diceRoller";

const { colors, spacing, radius, fontSize } = HORUS_THEME;

export default function DiceFormulaRoller() {
  const [formula, setFormula] = useState("d20");
  const [result, setResult] = useState<DiceRollResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function roll() {
    try {
      const nextResult = rollFormula(formula);
      setResult(nextResult);
      setError(null);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Fórmula inválida.");
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        value={formula}
        onChangeText={setFormula}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="d6+2d8+4"
        placeholderTextColor={colors.neutral.stone}
        style={styles.input}
      />
      <Pressable style={styles.button} onPress={roll}>
        <Text style={styles.buttonText}>LANZAR</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {result ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultTotal}>{result.total}</Text>
          <Text style={styles.resultFormula}>{result.formula}</Text>
          <Text style={styles.resultBreakdown}>{formatRollBreakdown(result)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },

  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: "rgba(201, 162, 74, 0.45)",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.textLight,
    fontSize: fontSize.md,
    fontWeight: "800",
    backgroundColor: "#090A0C",
  },

  button: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.premium,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111012",
  },

  buttonText: {
    color: colors.premium,
    fontSize: fontSize.sm,
    fontWeight: "900",
    letterSpacing: 1,
  },

  error: {
    color: "#FF7B7B",
    fontSize: fontSize.sm,
    fontWeight: "800",
  },

  resultBox: {
    borderWidth: 1,
    borderColor: "rgba(201, 162, 74, 0.35)",
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: "#090A0C",
  },

  resultTotal: {
    color: colors.textLight,
    fontSize: 34,
    fontWeight: "900",
  },

  resultFormula: {
    marginTop: spacing.xs,
    color: colors.premium,
    fontSize: fontSize.sm,
    fontWeight: "900",
  },

  resultBreakdown: {
    marginTop: spacing.xs,
    color: colors.textLight,
    opacity: 0.72,
    fontSize: fontSize.sm,
    fontWeight: "700",
  },
});
