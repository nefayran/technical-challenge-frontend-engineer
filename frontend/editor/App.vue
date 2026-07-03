<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";

import ConflictDialog from "./components/ConflictDialog.vue";
import Icon from "./components/Icon.vue";
import EditorCanvas from "./components/EditorCanvas.vue";
import GenerateDialog from "./components/GenerateDialog.vue";
import LevelSidebar from "./components/LevelSidebar.vue";
import PlaytestOverlay from "./components/PlaytestOverlay.vue";
import SaveStatus from "./components/SaveStatus.vue";
import StatsPanel from "./components/StatsPanel.vue";
import Toolbar from "./components/Toolbar.vue";
import TourOverlay from "./components/TourOverlay.vue";
import { LOCALES, locale, setLocale, t, type Locale } from "./i18n.ts";
import {
  boot,
  chrome,
  discardDraft,
  gridRef,
  redo,
  rendererRef,
  requestRedraw,
  restoreDraft,
  undo,
} from "./store.ts";
import { setTheme, theme } from "./tokens.ts";
import type { ToolKind } from "./types.ts";

const showGenerate = ref(false);
const canvasRef = ref<InstanceType<typeof EditorCanvas> | null>(null);

const TOUR_SEEN_KEY = "maze-editor-tour-seen";
const showTour = ref(false);

function closeTour(): void {
  showTour.value = false;
  localStorage.setItem(TOUR_SEEN_KEY, "1");
}

// First visit: open the tour once the level has loaded, so every anchor
// exists and the board is visible behind the spotlight.
watch(
  () => chrome.loading,
  (loading) => {
    if (!loading && chrome.loadError === "" && localStorage.getItem(TOUR_SEEN_KEY) === null) {
      showTour.value = true;
    }
  },
);

const TOOL_SHORTCUTS: Record<string, ToolKind> = {
  "1": "paint",
  "2": "erase",
  "3": "line",
  "4": "rect",
  "5": "flood",
  "6": "pan",
};

watch(theme, () => {
  const grid = gridRef.value;
  if (grid !== null) {
    rendererRef.value?.reset(grid);
  }
  requestRedraw();
});

function toggleTheme(): void {
  setTheme(theme.value === "dark" ? "light" : "dark");
}

function draftTime(savedAt: number): string {
  return new Date(savedAt).toLocaleTimeString();
}

function isTextInput(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

function onKeyDown(event: KeyboardEvent): void {
  if (isTextInput(event.target) || chrome.playtesting || chrome.conflict !== null) {
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) {
      redo();
    } else {
      undo();
    }
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }
  const tool = TOOL_SHORTCUTS[event.key];
  if (tool !== undefined) {
    chrome.tool = tool;
    return;
  }
  if (event.key.toLowerCase() === "f") {
    canvasRef.value?.fit();
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
  void boot();
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
});
</script>

<template>
  <div class="editor">
    <header>
      <h1>{{ t("app.title") }}</h1>
      <div class="header-right">
        <span data-tour="status"><SaveStatus /></span>
        <button
          data-tour="play"
          :disabled="gridRef === null"
          :title="t('app.play')"
          @click="chrome.playtesting = true"
        >
          {{ t("app.play") }}
        </button>
        <span data-tour="theme" class="header-right-group">
          <select
            :value="locale"
            :aria-label="'Language'"
            @change="setLocale(($event.target as HTMLSelectElement).value as Locale)"
          >
            <option v-for="l in LOCALES" :key="l" :value="l">{{ l.toUpperCase() }}</option>
          </select>
          <button
            class="icon-btn"
            :aria-label="`Theme: ${theme}`"
            :title="`Theme: ${theme}`"
            @click="toggleTheme()"
          >
            <Icon :name="theme === 'dark' ? 'sun' : 'moon'" />
          </button>
        </span>
        <button
          class="icon-btn help-btn"
          data-tour="help"
          :aria-label="t('tour.open')"
          :title="t('tour.open')"
          @click="showTour = true"
        >
          ?
        </button>
      </div>
    </header>

    <div v-if="chrome.draftOffer !== null" class="draft-banner" role="alert">
      <span>{{ t("draft.banner", { time: draftTime(chrome.draftOffer.savedAt) }) }}</span>
      <button class="active" @click="restoreDraft()">{{ t("draft.restore") }}</button>
      <button @click="discardDraft()">{{ t("draft.discard") }}</button>
    </div>

    <div v-if="chrome.loadError" class="error-banner" role="alert">
      {{ t("error.load") }}: {{ chrome.loadError }}
    </div>

    <div class="body">
      <LevelSidebar @generate="showGenerate = true" />
      <main>
        <Toolbar @fit="canvasRef?.fit()" />
        <EditorCanvas ref="canvasRef" />
        <StatsPanel />
      </main>
    </div>

    <GenerateDialog v-if="showGenerate" @close="showGenerate = false" />
    <ConflictDialog v-if="chrome.conflict !== null" />
    <PlaytestOverlay v-if="chrome.playtesting" @close="chrome.playtesting = false" />
    <TourOverlay v-if="showTour" @close="closeTour()" />
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-xl);
  padding: var(--space-lg) var(--space-xl);
  border-bottom: var(--border-width) solid var(--color-border);
  background: var(--color-bg-panel);
}

h1 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: var(--font-tracking-wide);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
}

.header-right-group {
  display: inline-flex;
  align-items: center;
  gap: var(--space-lg);
}

.help-btn {
  font-weight: var(--font-weight-bold);
}

.draft-banner,
.error-banner {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-md) var(--space-lg);
  border-bottom: var(--border-width) solid var(--color-border);
  background: var(--color-bg-surface);
  font-size: var(--font-size-md);
}

.draft-banner {
  border-left: var(--space-xs) solid var(--color-warning);
}

.error-banner {
  border-left: var(--space-xs) solid var(--color-danger);
  color: var(--color-danger);
}

.body {
  display: flex;
  flex: 1;
  min-height: 0;
}

main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
</style>
