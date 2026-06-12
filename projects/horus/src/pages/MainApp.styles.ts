import { StyleSheet } from "react-native";

import { HORUS_THEME } from "../theme/theme";

const { colors, spacing, radius, fontSize, shadow } = HORUS_THEME;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030405",
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    justifyContent: "center",
  },

  dreadBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#030405",
    overflow: "hidden",
  },

  redVeil: {
    position: "absolute",
    top: -120,
    left: -80,
    right: -80,
    height: 300,
    backgroundColor: "#7A0D0D",
    borderBottomLeftRadius: 240,
    borderBottomRightRadius: 240,
  },

  topScratch: {
    position: "absolute",
    top: 86,
    left: -20,
    width: "78%",
    height: 1,
    backgroundColor: "rgba(201, 162, 74, 0.2)",
    transform: [{ rotate: "-7deg" }],
  },

  bottomScratch: {
    position: "absolute",
    bottom: 96,
    right: -16,
    width: "68%",
    height: 1,
    backgroundColor: "rgba(139, 30, 30, 0.42)",
    transform: [{ rotate: "9deg" }],
  },

  scanLineOne: {
    position: "absolute",
    top: "34%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },

  scanLineTwo: {
    position: "absolute",
    top: "63%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(139, 30, 30, 0.18)",
  },

  topLogo: {
    position: "absolute",
    top: spacing.xxl,
    alignSelf: "center",
    zIndex: 2,
  },

  content: {
    flex: 1,
    justifyContent: "center",
  },

  loadingCard: {
    backgroundColor: "rgba(10, 10, 12, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(201, 162, 74, 0.7)",
    borderRadius: radius.xl,
    padding: spacing.xxl,
    alignItems: "center",
    ...shadow.panel,
  },

  loadingText: {
    color: colors.textLight,
    fontSize: fontSize.lg,
    fontWeight: "700",
    marginTop: spacing.md,
  },

  subText: {
    color: colors.premium,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },

  header: {
    marginBottom: spacing.xl,
  },

  headerLogoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },

  kicker: {
    color: "#C23B3B",
    fontSize: fontSize.xs,
    fontWeight: "800",
    letterSpacing: 2,
  },

  username: {
    color: colors.textLight,
    fontSize: 34,
    fontWeight: "900",
    marginTop: spacing.xs,
    textShadowColor: "rgba(139, 30, 30, 0.72)",
    textShadowRadius: 14,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: spacing.sm,
  },

  statusText: {
    color: colors.textLight,
    opacity: 0.75,
  },

  panel: {
    backgroundColor: "rgba(9, 10, 12, 0.94)",
    borderRadius: radius.xl,
    padding: spacing.lg,
    minHeight: 280,
    borderWidth: 1,
    borderColor: "rgba(201, 162, 74, 0.38)",
    ...shadow.panel,
  },

  panelTitle: {
    color: colors.textLight,
    fontSize: fontSize.md,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },

  dynamicShell: {
    flex: 1,
    backgroundColor: "rgba(9, 10, 12, 0.94)",
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(201, 162, 74, 0.38)",
    overflow: "hidden",
    ...shadow.panel,
  },

  dynamicHeader: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(201, 162, 74, 0.24)",
  },

  dynamicSubtitle: {
    color: colors.premium,
    fontSize: fontSize.sm,
    fontWeight: "800",
  },

  characterSelector: {
    marginTop: spacing.md,
    flexGrow: 0,
  },

  characterSelectorContent: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },

  characterChip: {
    minWidth: 118,
    maxWidth: 180,
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(201, 162, 74, 0.35)",
    backgroundColor: "#090A0C",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },

  characterChipActive: {
    borderColor: colors.premium,
    backgroundColor: "#3B080A",
  },

  characterChipName: {
    color: colors.textLight,
    fontSize: fontSize.sm,
    fontWeight: "900",
  },

  characterChipNameActive: {
    color: colors.premium,
  },

  characterChipRole: {
    marginTop: 2,
    color: colors.textLight,
    opacity: 0.62,
    fontSize: fontSize.xs,
    fontWeight: "800",
  },

  characterChipRoleActive: {
    opacity: 0.92,
  },

  dynamicBody: {
    flex: 1,
  },

  dynamicBodyContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },

  bottomTabs: {
    flexGrow: 0,
    borderTopWidth: 1,
    borderTopColor: "rgba(201, 162, 74, 0.32)",
    backgroundColor: "#090A0C",
  },

  bottomTabsContent: {
    flexGrow: 1,
    paddingBottom: spacing.md,
  },

  bottomTab: {
    minWidth: 112,
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    borderTopWidth: 2,
    borderTopColor: "transparent",
  },

  bottomTabActive: {
    borderTopColor: colors.premium,
    backgroundColor: "#161115",
  },

  bottomTabText: {
    color: colors.textLight,
    opacity: 0.62,
    fontSize: fontSize.xs,
    fontWeight: "900",
    textAlign: "center",
  },

  bottomTabTextActive: {
    color: colors.premium,
    opacity: 1,
  },

  genericGrid: {
    gap: spacing.lg,
  },

  genericBlock: {
    backgroundColor: "#090A0C",
    borderWidth: 1,
    borderColor: "rgba(201, 162, 74, 0.28)",
    borderRadius: radius.md,
    padding: spacing.md,
  },

  schemaPage: {
    gap: spacing.lg,
  },

  schemaSection: {
    gap: spacing.sm,
  },

  sectionTitle: {
    color: colors.premium,
    fontSize: fontSize.sm,
    fontWeight: "900",
    letterSpacing: 1,
  },

  drawerButtonShell: {
    marginTop: spacing.md,
  },

  drawerButton: {
    minHeight: 82,
    backgroundColor: "#111012",
    borderWidth: 1,
    borderColor: "rgba(201, 162, 74, 0.5)",
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
    ...shadow.panel,
  },

  drawerButtonOpen: {
    backgroundColor: "#3B080A",
    borderColor: colors.premium,
  },

  drawerButtonLabel: {
    color: colors.textLight,
    fontSize: fontSize.xl,
    fontWeight: "900",
    letterSpacing: 1,
  },

  drawerButtonLabelOpen: {
    color: colors.premium,
  },

  drawerButtonMeta: {
    color: colors.textLight,
    opacity: 0.62,
    fontSize: fontSize.sm,
    fontWeight: "700",
    marginTop: spacing.xs,
  },

  drawerButtonMetaOpen: {
    opacity: 0.9,
  },

  drawerChevron: {
    color: colors.premium,
    fontSize: fontSize.xs,
    fontWeight: "900",
    letterSpacing: 2,
  },

  drawerChevronOpen: {
    color: colors.textLight,
  },

  drawerContent: {
    overflow: "hidden",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(201, 162, 74, 0.28)",
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    backgroundColor: "rgba(0, 0, 0, 0.34)",
    marginHorizontal: spacing.sm,
    paddingHorizontal: spacing.sm,
  },

  sheetList: {
    maxHeight: 310,
  },

  sheetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },

  sheetStat: {
    width: "48%",
    minHeight: 74,
    backgroundColor: "#090A0C",
    borderWidth: 1,
    borderColor: "rgba(201, 162, 74, 0.35)",
    borderRadius: radius.md,
    padding: spacing.md,
  },

  sheetLabel: {
    color: colors.textLight,
    opacity: 0.62,
    fontSize: fontSize.xs,
    fontWeight: "900",
    marginBottom: spacing.xs,
  },

  sheetValue: {
    color: colors.textLight,
    fontSize: fontSize.lg,
    fontWeight: "900",
  },

  derivedValue: {
    color: colors.premium,
  },

  fieldInput: {
    minHeight: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "rgba(201, 162, 74, 0.45)",
    backgroundColor: "#111012",
    color: colors.textLight,
    fontSize: fontSize.md,
    fontWeight: "800",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },

  fieldInputReadonly: {
    opacity: 0.7,
  },

  cycleButton: {
    minHeight: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.premium,
    backgroundColor: "#111012",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },

  cycleText: {
    color: colors.premium,
    fontSize: fontSize.sm,
    fontWeight: "900",
  },

  buttonedInteger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },

  stepButton: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.premium,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111012",
  },

  stepButtonText: {
    color: colors.premium,
    fontSize: fontSize.lg,
    fontWeight: "900",
  },

  arrayField: {
    gap: spacing.sm,
  },

  arrayItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(201, 162, 74, 0.22)",
    paddingTop: spacing.sm,
  },

  arrayItemText: {
    flex: 1,
    gap: spacing.xs,
  },

  arrayItemField: {
    gap: spacing.xs,
  },

  arrayItemLine: {
    color: colors.textLight,
    fontSize: fontSize.sm,
    fontWeight: "800",
  },

  arrayAddButton: {
    minHeight: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.premium,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111012",
  },

  arrayAddText: {
    color: colors.premium,
    fontSize: fontSize.sm,
    fontWeight: "900",
  },

  emptyInline: {
    color: colors.textLight,
    opacity: 0.58,
    fontSize: fontSize.sm,
  },

  emptyText: {
    color: colors.textLight,
    opacity: 0.58,
    fontSize: fontSize.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },

  resourcesList: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    paddingRight: spacing.sm,
  },

  resourceButton: {
    width: 154,
    minHeight: 88,
    backgroundColor: "#090A0C",
    borderWidth: 1,
    borderColor: colors.border.gold,
    borderRadius: radius.md,
    padding: spacing.md,
  },

  resourceType: {
    color: colors.premium,
    fontSize: fontSize.xs,
    fontWeight: "900",
    marginBottom: spacing.xs,
  },

  resourceName: {
    color: colors.textLight,
    fontSize: fontSize.sm,
    fontWeight: "800",
    lineHeight: 18,
  },

  resourceTime: {
    color: colors.textLight,
    fontSize: fontSize.xs,
    opacity: 0.65,
    marginTop: spacing.sm,
  },

  errorBox: {
    backgroundColor: "#3B080A",
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.premium,
  },

  errorTitle: {
    color: colors.textLight,
    fontSize: fontSize.lg,
    fontWeight: "900",
  },

  errorText: {
    color: colors.textLight,
    marginTop: spacing.sm,
  },

  retryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.border.dark,
    borderWidth: 1,
    borderColor: colors.premium,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
  },

  retryText: {
    color: colors.textLight,
    fontWeight: "900",
    letterSpacing: 2,
  },

  countdownMini: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.lg,
    right: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#FF3030",
    backgroundColor: "rgba(59, 8, 10, 0.96)",
    alignItems: "center",
  },

  countdownMiniText: {
    color: colors.textLight,
    fontWeight: "900",
    letterSpacing: 1,
  },
});

