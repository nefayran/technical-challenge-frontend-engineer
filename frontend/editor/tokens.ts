// Design tokens — single source of truth for both worlds: injected as CSS
// custom properties for Vue chrome, read directly by the canvas renderer
// (canvas cannot use CSS vars without a getComputedStyle round-trip).
// Colors are per-theme; everything else is theme-independent.

import { ref } from "vue";

export type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "maze-editor-theme";

type ColorTokens = {
  bgApp: string;
  bgPanel: string;
  bgSurface: string;
  bgControl: string;
  bgControlHover: string;
  border: string;
  borderMuted: string;
  borderControl: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textDim: string;
  textFaint: string;
  accent: string;
  accentBg: string;
  accentText: string;
  info: string;
  warning: string;
  danger: string;
  neutral: string;
  backdrop: string;

  canvasBg: string;
  boardEmpty: string;
  wall: string;
  pellet: string;
  power: string;
  player: string;
  ghost: string;
  gridLine: string;
  boardBorder: string;
  hover: string;
  preview: string;
  spawnArrow: string;
};

// Dark palette follows noeon.ai: near-black #0e1013 ground, thin #48485c
// hairlines, white text at 82%, muted slate #9096a6 secondary, and the
// violet/magenta/blue range of their graph visual as accents. Sharp corners.
const DARK: ColorTokens = {
  bgApp: "#0e1013",
  bgPanel: "#121419",
  bgSurface: "#16181f",
  bgControl: "#16181f",
  bgControlHover: "#1e212a",
  border: "#22252e",
  borderMuted: "#22252e",
  borderControl: "#48485c",
  borderStrong: "#48485c",
  text: "#d1d3d9",
  textMuted: "#9096a6",
  textDim: "#767c8c",
  textFaint: "#585e6d",
  accent: "#8b6ce0",
  accentBg: "#241f3d",
  accentText: "#e6e0ff",
  info: "#5b8def",
  warning: "#d9a13d",
  danger: "#d64d7e",
  neutral: "#9096a6",
  backdrop: "rgba(10, 11, 14, 0.75)",

  canvasBg: "#0b0d10",
  boardEmpty: "#14161b",
  wall: "#414463",
  pellet: "#9096a6",
  power: "#d64d8e",
  player: "#e8c35c",
  ghost: "#c2557a",
  gridLine: "rgba(255, 255, 255, 0.05)",
  boardBorder: "#48485c",
  hover: "rgba(255, 255, 255, 0.35)",
  preview: "rgba(139, 108, 224, 0.45)",
  spawnArrow: "#0e1013",
};

const LIGHT: ColorTokens = {
  bgApp: "#f5f6f8",
  bgPanel: "#ffffff",
  bgSurface: "#ffffff",
  bgControl: "#ffffff",
  bgControlHover: "#eceef2",
  border: "#e3e5ea",
  borderMuted: "#e3e5ea",
  borderControl: "#b6b9c9",
  borderStrong: "#9d9fb3",
  text: "#191b21",
  textMuted: "#4c5160",
  textDim: "#6d7383",
  textFaint: "#8f95a5",
  accent: "#6a4fd8",
  accentBg: "#ebe6fb",
  accentText: "#2a1f66",
  info: "#2b62d9",
  warning: "#9c6a12",
  danger: "#c23568",
  neutral: "#6d7383",
  backdrop: "rgba(20, 22, 27, 0.4)",

  canvasBg: "#eceef2",
  boardEmpty: "#fafbfc",
  wall: "#5a5e8a",
  pellet: "#6d7383",
  power: "#c23e83",
  player: "#d9a635",
  ghost: "#b04a70",
  gridLine: "rgba(0, 0, 0, 0.06)",
  boardBorder: "#9d9fb3",
  hover: "rgba(0, 0, 0, 0.35)",
  preview: "rgba(106, 79, 216, 0.4)",
  spawnArrow: "#fafbfc",
};

const THEMES: Record<Theme, ColorTokens> = { dark: DARK, light: LIGHT };

const BASE = {
  space: {
    xxs: "2px",
    xs: "4px",
    sm: "6px",
    md: "8px",
    lg: "12px",
    xl: "20px",
  },
  size: {
    dot: "9px",
    swatch: "12px",
    inputNarrow: "90px",
    input: "110px",
    sidebar: "190px",
    dialogMin: "260px",
    dialogWide: "440px",
    controlPadX: "10px",
  },
  border: {
    width: "1px",
  },
  radius: {
    sm: "0px",
    md: "0px",
    lg: "0px",
  },
  font: {
    body: '"Suisse Intl", -apple-system, system-ui, "Segoe UI", "Helvetica Neue", sans-serif',
    mono: "ui-monospace, monospace",
    sizeSm: "0.8rem",
    sizeMd: "0.85rem",
    sizeLg: "1rem",
    weightBold: "500",
    trackingWide: "0.08em",
  },
  z: {
    dialog: "20",
    conflict: "30",
    playtest: "40",
  },
} as const;

function initialTheme(): Theme {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "dark" || saved === "light") {
    return saved;
  }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export const theme = ref<Theme>(initialTheme());

// Canvas-side palette for the current theme; the renderer reads this directly.
export function canvasColors(): ColorTokens {
  return THEMES[theme.value];
}

export function applyCssTokens(root: HTMLElement = document.documentElement): void {
  const groups: Record<string, Record<string, string>> = {
    ...BASE,
    color: THEMES[theme.value],
  };
  for (const [group, values] of Object.entries(groups)) {
    for (const [name, value] of Object.entries(values)) {
      root.style.setProperty(`--${group}-${kebab(name)}`, value);
    }
  }
  root.style.colorScheme = theme.value;
}

export function setTheme(next: Theme): void {
  theme.value = next;
  localStorage.setItem(THEME_STORAGE_KEY, next);
  applyCssTokens();
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
}
