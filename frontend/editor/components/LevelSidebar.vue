<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

import { CONFIG } from "../config.ts";
import { t } from "../i18n.ts";
import { chrome, duplicateLevel, newBlankLevel, openLevel, refreshLevelList } from "../store.ts";

const emit = defineEmits<{ generate: [] }>();

const showNewDialog = ref(false);
const newWidth = ref(CONFIG.newLevel.defaultWidth);
const newHeight = ref(CONFIG.newLevel.defaultHeight);
const widthInput = ref<HTMLInputElement | null>(null);

watch(showNewDialog, async (open) => {
  if (open) {
    await nextTick();
    widthInput.value?.focus();
  }
});

function clampSize(value: number): number {
  return Math.min(CONFIG.newLevel.maxSize, Math.max(CONFIG.newLevel.minSize, Math.round(value)));
}

async function createBlank(): Promise<void> {
  showNewDialog.value = false;
  await newBlankLevel(clampSize(newWidth.value), clampSize(newHeight.value));
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 10)}…` : id;
}
</script>

<template>
  <aside class="sidebar">
    <div class="header">
      <span>{{ t("sidebar.levels") }}</span>
      <button :title="t('sidebar.refresh')" :aria-label="t('sidebar.refresh')" @click="refreshLevelList()">
        ⟳
      </button>
    </div>
    <nav :aria-label="t('sidebar.levels')">
      <ul class="list">
        <li v-for="id in chrome.levels" :key="id">
          <button
            class="level-btn"
            :class="{ active: id === chrome.levelId }"
            :aria-current="id === chrome.levelId ? 'true' : undefined"
            :title="id"
            @click="openLevel(id)"
          >
            {{ shortId(id) }}
          </button>
        </li>
      </ul>
    </nav>
    <div class="actions">
      <button @click="showNewDialog = true">{{ t("sidebar.newBlank") }}</button>
      <button @click="emit('generate')">{{ t("sidebar.generate") }}</button>
      <button :disabled="chrome.loading" :title="t('sidebar.duplicate.hint')" @click="duplicateLevel()">
        {{ t("sidebar.duplicate") }}
      </button>
    </div>

    <div
      v-if="showNewDialog"
      class="dialog-backdrop"
      @click.self="showNewDialog = false"
      @keydown.esc="showNewDialog = false"
    >
      <div class="dialog" role="dialog" aria-modal="true" :aria-label="t('newLevel.title')">
        <h3>{{ t("newLevel.title") }}</h3>
        <label>
          {{ t("newLevel.width") }}
          <input
            ref="widthInput"
            v-model.number="newWidth"
            type="number"
            :min="CONFIG.newLevel.minSize"
            :max="CONFIG.newLevel.maxSize"
            @keydown.enter="createBlank()"
          />
        </label>
        <label>
          {{ t("newLevel.height") }}
          <input
            v-model.number="newHeight"
            type="number"
            :min="CONFIG.newLevel.minSize"
            :max="CONFIG.newLevel.maxSize"
            @keydown.enter="createBlank()"
          />
        </label>
        <div class="dialog-actions">
          <button @click="showNewDialog = false">{{ t("newLevel.cancel") }}</button>
          <button class="active" @click="createBlank()">{{ t("newLevel.create") }}</button>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--size-sidebar);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: var(--border-width) solid var(--color-border);
  background: var(--color-bg-panel);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-lg) var(--space-lg);
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: var(--font-tracking-wide);
  color: var(--color-text-dim);
  border-bottom: var(--border-width) solid var(--color-border);
}

nav {
  flex: 1;
  overflow-y: auto;
}

.list {
  list-style: none;
  margin: 0;
  padding: var(--space-sm);
}

.level-btn {
  width: 100%;
  text-align: left;
  background: transparent;
  border-color: transparent;
  font-family: var(--font-mono);
  font-size: var(--font-size-md);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  border-top: var(--border-width) solid var(--color-border);
}
</style>
