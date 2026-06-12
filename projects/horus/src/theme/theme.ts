// Generado por Launcher EVA.

export const HORUS_COLORS = {
  background: "#0d0f12",
  surface: "#1a1f27",
  action: "#c65353",
  premium: "#c9a24a",
  textDark: "#1A1A1A",
  textLight: "#ededed",
  neutral: {
    stone: "#9fa7b3",
    gold: "#c9a24a",
  },
  border: {
    light: "#111419",
    dark: "#262A30",
    gold: "#c9a24a",
  },
  status: {
    success: "#3F6F4E",
    warning: "#c9a24a",
    danger: "#c65353",
    info: "#66ccff",
  },
} as const;

export const HORUS_THEME = {
  colors: HORUS_COLORS,
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 6, md: 10, lg: 16, xl: 22 },
  fontSize: { xs: 12, sm: 14, md: 16, lg: 20, xl: 28 },
  shadow: {
    panel: {
      shadowColor: "#000000",
      shadowOpacity: 0.35,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
  },
} as const;
