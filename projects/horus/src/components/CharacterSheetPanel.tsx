import { Animated, Pressable, ScrollView, Text, View } from "react-native";

import DiceFormulaRoller from "./DiceFormulaRoller";
import { MediaResource } from "./MediaResourceModal";
import SheetFieldCard from "./SheetFieldCard";
import { styles } from "../pages/MainApp.styles";
import {
  CharacterSheet,
  CharacterSheetField,
  CharacterSheetSchemaPage,
  CharacterSheetSchemaSection,
} from "../types/characterSheet";
import { PlayerCharacter, SessionMediaResource } from "../types/evaSession";
import {
  GENERIC_TAB_KEY,
  getCharacterName,
  getGenericFields,
  TOOLS_TAB_KEY,
} from "../utils/characterSheetModel";
import { formatResourceTime } from "../utils/evaNotifications";

export type DrawerKey = "sheet" | "dice" | "files";

type CharacterSheetPanelProps = {
  username: string;
  sheet: CharacterSheet | null;
  activeCharacter: PlayerCharacter | null;
  characters: PlayerCharacter[];
  activeCharacterId: number | null;
  activeDrawer: DrawerKey | null;
  activeDynamicTab: string;
  dynamicPages: CharacterSheetSchemaPage[];
  sheetDrawerAnim: Animated.Value;
  diceDrawerAnim: Animated.Value;
  filesDrawerAnim: Animated.Value;
  resourceHistory: SessionMediaResource[];
  onSelectCharacter: (character: PlayerCharacter) => void;
  onSetActiveSheetTab: (tab: string) => void;
  onToggleDrawer: (drawer: DrawerKey) => void;
  onOpenResource: (resource: MediaResource) => void;
  onUpdateField: (field: CharacterSheetField, nextValue: CharacterSheetField["value"]) => void;
  onUpdateFieldDelta: (field: CharacterSheetField, delta: number) => void;
  onUpdateFieldLocal: (fieldKey: string, nextValue: CharacterSheetField["value"]) => void;
};

export default function CharacterSheetPanel({
  username,
  sheet,
  activeCharacter,
  characters,
  activeCharacterId,
  activeDrawer,
  activeDynamicTab,
  dynamicPages,
  sheetDrawerAnim,
  diceDrawerAnim,
  filesDrawerAnim,
  resourceHistory,
  onSelectCharacter,
  onSetActiveSheetTab,
  onToggleDrawer,
  onOpenResource,
  onUpdateField,
  onUpdateFieldDelta,
  onUpdateFieldLocal,
}: CharacterSheetPanelProps) {
  const activePage = dynamicPages.find((page) => page.key === activeDynamicTab);

  if (!sheet) {
    return renderClassicPanel();
  }

  return (
    <View style={styles.dynamicShell}>
      <View style={styles.dynamicHeader}>
        <Text style={styles.panelTitle}>{sheet.template.label || "Ficha"}</Text>
        <Text style={styles.dynamicSubtitle}>
          {activeCharacter
            ? `${activeCharacter.name} · ${activeCharacter.role}`
            : getCharacterName(sheet, username)}
        </Text>
        {renderCharacterSelector()}
      </View>

      <ScrollView
        style={styles.dynamicBody}
        contentContainerStyle={styles.dynamicBodyContent}
      >
        {activeDynamicTab === GENERIC_TAB_KEY ? renderGenericTab() : null}
        {activeDynamicTab === TOOLS_TAB_KEY ? renderToolsTab() : null}
        {activePage ? renderSchemaPage(activePage) : null}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bottomTabs}
        contentContainerStyle={styles.bottomTabsContent}
      >
        {dynamicPages.map((page) => renderBottomTab(page.key, page.label))}
        {renderBottomTab(GENERIC_TAB_KEY, "General")}
        {renderBottomTab(TOOLS_TAB_KEY, "Herramientas")}
      </ScrollView>
    </View>
  );

  function renderDrawerButton(drawer: DrawerKey, label: string, count: number) {
    const expanded = activeDrawer === drawer;
    const anim =
      drawer === "sheet"
        ? sheetDrawerAnim
        : drawer === "dice"
          ? diceDrawerAnim
          : filesDrawerAnim;
    const scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.03],
    });

    return (
      <Animated.View style={[styles.drawerButtonShell, { transform: [{ scale }] }]}>
        <Pressable
          style={[
            styles.drawerButton,
            expanded ? styles.drawerButtonOpen : null,
          ]}
          onPress={() => onToggleDrawer(drawer)}
        >
          <View>
            <Text
              style={[
                styles.drawerButtonLabel,
                expanded ? styles.drawerButtonLabelOpen : null,
              ]}
            >
              {label}
            </Text>
            <Text
              style={[
                styles.drawerButtonMeta,
                expanded ? styles.drawerButtonMetaOpen : null,
              ]}
            >
              {count} {count === 1 ? "elemento" : "elementos"}
            </Text>
          </View>

          <Text
            style={[
              styles.drawerChevron,
              expanded ? styles.drawerChevronOpen : null,
            ]}
          >
            {expanded ? "OCULTAR" : "ABRIR"}
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  function renderFilesDrawer() {
    return (
      <>
        {renderDrawerButton("files", "Archivos", resourceHistory.length)}
        <Animated.View
          style={[
            styles.drawerContent,
            {
              maxHeight: filesDrawerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 170],
              }),
              opacity: filesDrawerAnim,
            },
          ]}
        >
          {renderResourceHistory()}
        </Animated.View>
      </>
    );
  }

  function renderResourceHistory() {
    return resourceHistory.length > 0 ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.resourcesList}
      >
        {resourceHistory.map((item) => (
          <Pressable
            key={item.key}
            style={styles.resourceButton}
            onPress={() => onOpenResource(item.resource)}
          >
            <Text style={styles.resourceType}>{item.resource.tipo}</Text>
            <Text style={styles.resourceName} numberOfLines={2}>
              {item.resource.nombre}
            </Text>
            <Text style={styles.resourceTime}>
              {formatResourceTime(item.receivedAt)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    ) : (
      <Text style={styles.emptyText}>Aún no has recibido archivos.</Text>
    );
  }

  function renderClassicPanel() {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Lo que EVA te permite conservar</Text>

        {sheet && sheet.fields.length > 0 ? (
          <>
            {renderDrawerButton("sheet", sheet.template.label || "Ficha", sheet.fields.length)}
            <Animated.View
              style={[
                styles.drawerContent,
                {
                  maxHeight: sheetDrawerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 360],
                  }),
                  opacity: sheetDrawerAnim,
                },
              ]}
            >
              <ScrollView
                style={styles.sheetList}
                contentContainerStyle={styles.sheetGrid}
              >
                {sheet.fields.map((field) => renderFieldCard(field))}
              </ScrollView>
            </Animated.View>
          </>
        ) : null}

        {renderDrawerButton("dice", "Dados", 1)}
        <Animated.View
          style={[
            styles.drawerContent,
            {
              maxHeight: diceDrawerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 260],
              }),
              opacity: diceDrawerAnim,
            },
          ]}
        >
          <DiceFormulaRoller />
        </Animated.View>

        {renderFilesDrawer()}
      </View>
    );
  }

  function renderBottomTab(key: string, label: string) {
    const active = activeDynamicTab === key;

    return (
      <Pressable
        key={key}
        style={[styles.bottomTab, active ? styles.bottomTabActive : null]}
        onPress={() => onSetActiveSheetTab(key)}
      >
        <Text
          style={[styles.bottomTabText, active ? styles.bottomTabTextActive : null]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  function renderCharacterSelector() {
    if (characters.length <= 1) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.characterSelector}
        contentContainerStyle={styles.characterSelectorContent}
      >
        {characters.map((character) => {
          const active = character.id === activeCharacterId;

          return (
            <Pressable
              key={character.id}
              style={[styles.characterChip, active ? styles.characterChipActive : null]}
              onPress={() => onSelectCharacter(character)}
            >
              <Text
                style={[styles.characterChipName, active ? styles.characterChipNameActive : null]}
                numberOfLines={1}
              >
                {character.name}
              </Text>
              <Text
                style={[styles.characterChipRole, active ? styles.characterChipRoleActive : null]}
                numberOfLines={1}
              >
                {character.role}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  function renderGenericTab() {
    const genericFields = getGenericFields(sheet, dynamicPages);

    return (
      <View style={styles.genericGrid}>
        {genericFields.length > 0 ? (
          <View style={styles.genericBlock}>
            <Text style={styles.sectionTitle}>Ficha</Text>
            <View style={styles.sheetGrid}>
              {genericFields.map((field) => renderFieldCard(field))}
            </View>
          </View>
        ) : null}
        {genericFields.length === 0 ? (
          <View style={styles.genericBlock}>
            <Text style={styles.emptyText}>Sin campos generales.</Text>
          </View>
        ) : null}
      </View>
    );
  }

  function renderToolsTab() {
    return (
      <View style={styles.genericGrid}>
        <View style={styles.genericBlock}>
          <Text style={styles.sectionTitle}>Dados</Text>
          <DiceFormulaRoller />
        </View>
        <View style={styles.genericBlock}>
          <Text style={styles.sectionTitle}>Archivos</Text>
          {renderResourceHistory()}
        </View>
      </View>
    );
  }

  function renderSchemaPage(page: CharacterSheetSchemaPage) {
    return (
      <View style={styles.schemaPage}>
        {(page.sections || []).map((section) => renderSchemaSection(section))}
      </View>
    );
  }

  function renderSchemaSection(section: CharacterSheetSchemaSection) {
    const fields = (section.fields || [])
      .map((fieldKey) => sheet?.fields.find((field) => field.key === fieldKey))
      .filter((field): field is CharacterSheetField => Boolean(field));

    if (fields.length === 0) return null;

    return (
      <View key={section.key} style={styles.schemaSection}>
        <Text style={styles.sectionTitle}>{section.label}</Text>
        <View style={styles.sheetGrid}>
          {fields.map((field) => renderFieldCard(field))}
        </View>
      </View>
    );
  }

  function renderFieldCard(field: CharacterSheetField) {
    return (
      <SheetFieldCard
        key={field.key}
        field={field}
        sheet={sheet}
        username={username}
        activeCharacter={activeCharacter}
        onUpdateField={onUpdateField}
        onUpdateFieldDelta={onUpdateFieldDelta}
        onUpdateFieldLocal={onUpdateFieldLocal}
      />
    );
  }
}
