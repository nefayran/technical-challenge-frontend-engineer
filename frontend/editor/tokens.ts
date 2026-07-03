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

const DARK: ColorTokens = {
  bgApp: "#1a1a1a",
  bgPanel: "#222222",
  bgSurface: "#262626",
  bgControl: "#333333",
  bgControlHover: "#3d3d3d",
  border: "#333333",
  borderMuted: "#3a3a3a",
  borderControl: "#4a4a4a",
  borderStrong: "#444444",
  text: "#f5f5f5",
  textMuted: "#cccccc",
  textDim: "#999999",
  textFaint: "#777777",
  accent: "#4caf50",
  accentBg: "#2e7d32",
  accentText: "#f5f5f5",
  info: "#64b5f6",
  warning: "#ffb300",
  danger: "#ef5350",
  neutral: "#9e9e9e",
  backdrop: "rgba(0, 0, 0, 0.6)",

  canvasBg: "#1f1f1f",
  boardEmpty: "#2b2b2b",
  wall: "#3f51b5",
  pellet: "#e0e0e0",
  power: "#ffd54f",
  player: "#ffeb3b",
  ghost: "#ef5350",
  gridLine: "rgba(255, 255, 255, 0.06)",
  boardBorder: "#4caf50",
  hover: "rgba(255, 255, 255, 0.35)",
  preview: "rgba(255, 255, 255, 0.45)",
  spawnArrow: "#1a1a1a",
};

const LIGHT: ColorTokens = {
  bgApp: "#f4f4f4",
  bgPanel: "#ffffff",
  bgSurface: "#ffffff",
  bgControl: "#ececec",
  bgControlHover: "#e0e0e0",
  border: "#d8d8d8",
  borderMuted: "#e2e2e2",
  borderControl: "#c4c4c4",
  borderStrong: "#bbbbbb",
  text: "#1e1e1e",
  textMuted: "#444444",
  textDim: "#6d6d6d",
  textFaint: "#8a8a8a",
  accent: "#2e7d32",
  accentBg: "#c8e6c9",
  accentText: "#1e1e1e",
  info: "#1565c0",
  warning: "#b26a00",
  danger: "#c62828",
  neutral: "#757575",
  backdrop: "rgba(0, 0, 0, 0.35)",

  canvasBg: "#e8e8e8",
  boardEmpty: "#fafafa",
  wall: "#3f51b5",
  pellet: "#616161",
  power: "#f9a825",
  player: "#f4b400",
  ghost: "#d32f2f",
  gridLine: "rgba(0, 0, 0, 0.07)",
  boardBorder: "#2e7d32",
  hover: "rgba(0, 0, 0, 0.35)",
  preview: "rgba(0, 0, 0, 0.35)",
  spawnArrow: "#fafafa",
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
    sm: "3px",
    md: "4px",
    lg: "8px",
  },
  font: {
    body: "system-ui, sans-serif",
    mono: "ui-monospace, monospace",
    sizeSm: "0.8rem",
    sizeMd: "0.85rem",
    sizeLg: "1.25rem",
    weightBold: "600",
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
