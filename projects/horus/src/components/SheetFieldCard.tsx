import { Pressable, Text, TextInput, View } from "react-native";

import DiceThrowIntegerField from "./DiceThrowIntegerField";
import { styles } from "../pages/MainApp.styles";
import { CharacterSheet, CharacterSheetField } from "../types/characterSheet";
import { PlayerCharacter } from "../types/evaSession";
import {
  formatCycleLabel,
  getArrayItemFields,
  getCharacterName,
  getCycleOptions,
  getFieldDisplayValue,
  isFieldEditable,
} from "../utils/characterSheetModel";
import { isDiceThrowInteger } from "../utils/diceRoller";

type SheetFieldCardProps = {
  field: CharacterSheetField;
  sheet: CharacterSheet | null;
  username: string;
  activeCharacter: PlayerCharacter | null;
  onUpdateField: (field: CharacterSheetField, nextValue: CharacterSheetField["value"]) => void;
  onUpdateFieldDelta: (field: CharacterSheetField, delta: number) => void;
  onUpdateFieldLocal: (fieldKey: string, nextValue: CharacterSheetField["value"]) => void;
};

export default function SheetFieldCard({
  field,
  sheet,
  username,
  activeCharacter,
  onUpdateField,
  onUpdateFieldDelta,
  onUpdateFieldLocal,
}: SheetFieldCardProps) {
  return (
    <View key={field.key} style={styles.sheetStat}>
      <Text style={styles.sheetLabel} numberOfLines={1}>
        {field.label}
      </Text>
      {renderSheetField()}
    </View>
  );

  function renderSheetField() {
    const editable = isFieldEditable(field);
    const displayValue = getFieldDisplayValue(sheet, field);

    if (field.type === "array") {
      return renderArrayField(editable);
    }

    if (field.type === "cycle") {
      return renderCycleField(editable);
    }

    if (field.type === "b_int" && editable) {
      return (
        <View style={styles.buttonedInteger}>
          <Pressable
            style={styles.stepButton}
            onPress={() => onUpdateFieldDelta(field, -1)}
          >
            <Text style={styles.stepButtonText}>-</Text>
          </Pressable>
          <Text style={styles.sheetValue}>{Array.isArray(field.value) ? "0" : field.value || "0"}</Text>
          <Pressable
            style={styles.stepButton}
            onPress={() => onUpdateFieldDelta(field, 1)}
          >
            <Text style={styles.stepButtonText}>+</Text>
          </Pressable>
        </View>
      );
    }

    if (isDiceThrowInteger(field.type)) {
      return (
        <DiceThrowIntegerField
          field={field}
          username={username}
          characterName={activeCharacter?.name || getCharacterName(sheet, username)}
        />
      );
    }

    if (editable && (field.type === "text" || field.type === "int" || field.type === "b_int")) {
      return (
        <TextInput
          value={Array.isArray(field.value) ? "" : String(field.value ?? "")}
          keyboardType={field.type === "text" ? "default" : "numeric"}
          style={styles.fieldInput}
          onChangeText={(text) => onUpdateFieldLocal(field.key, text)}
          onEndEditing={(event) => onUpdateField(field, event.nativeEvent.text)}
        />
      );
    }

    return (
      <Text style={[styles.sheetValue, !editable ? styles.derivedValue : null]}>
        {displayValue}
      </Text>
    );
  }

  function renderArrayField(editable: boolean) {
    const items = Array.isArray(field.value) ? field.value : [];
    const itemFields = getArrayItemFields(field);

    return (
      <View style={styles.arrayField}>
        {items.length === 0 ? (
          <Text style={styles.emptyInline}>Sin elementos.</Text>
        ) : (
          items.map((item, index) => (
            <View key={`${field.key}-${index}`} style={styles.arrayItem}>
              <View style={styles.arrayItemText}>
                {itemFields.map((itemField) => (
                  <View key={itemField.key} style={styles.arrayItemField}>
                    <Text style={styles.arrayItemLine}>{itemField.label}</Text>
                    <TextInput
                      value={item[itemField.key] || ""}
                      editable={editable}
                      keyboardType={itemField.type === "int" || itemField.type === "number" ? "numeric" : "default"}
                      style={[styles.fieldInput, !editable ? styles.fieldInputReadonly : null]}
                      onChangeText={(text) => {
                        const nextItems = items.map((candidate, itemIndex) => (
                          itemIndex === index ? { ...candidate, [itemField.key]: text } : candidate
                        ));
                        onUpdateFieldLocal(field.key, nextItems);
                      }}
                      onEndEditing={(event) => {
                        const nextItems = items.map((candidate, itemIndex) => (
                          itemIndex === index
                            ? { ...candidate, [itemField.key]: event.nativeEvent.text }
                            : candidate
                        ));
                        onUpdateField(field, nextItems);
                      }}
                    />
                  </View>
                ))}
              </View>
              {editable ? (
                <Pressable
                  style={styles.stepButton}
                  onPress={() => {
                    const nextItems = items.filter((_item, itemIndex) => itemIndex !== index);
                    onUpdateField(field, nextItems);
                  }}
                >
                  <Text style={styles.stepButtonText}>×</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
        {editable ? (
          <Pressable
            style={styles.arrayAddButton}
            onPress={() => {
              const nextItem = Object.fromEntries(
                itemFields.map((itemField) => [itemField.key, itemField.defaultValue || ""])
              );
              onUpdateField(field, [...items, nextItem]);
            }}
          >
            <Text style={styles.arrayAddText}>Añadir</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  function renderCycleField(editable: boolean) {
    const options = getCycleOptions(sheet, field);
    const currentIndex = Math.max(0, options.indexOf(String(field.value || options[0] || "")));
    const current = options[currentIndex] || String(field.value || "—");

    return (
      <Pressable
        disabled={!editable || options.length === 0}
        style={[styles.cycleButton, !editable ? styles.fieldInputReadonly : null]}
        onPress={() => {
          const next = options[(currentIndex + 1) % options.length];
          onUpdateField(field, next);
        }}
      >
        <Text style={styles.cycleText}>{formatCycleLabel(current)}</Text>
      </Pressable>
    );
  }
}
