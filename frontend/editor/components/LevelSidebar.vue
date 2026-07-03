<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

import { CONFIG } from "../config.ts";
import { t } from "../i18n.ts";
import Icon from "./Icon.vue";
import {
  chrome,
  duplicateLevel,
  newBlankLevel,
  openLevel,
  refreshLevelList,
  renameLevel,
} from "../store.ts";

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

function displayName(level: { id: string; name: string }): string {
  const label = level.name || level.id;
  return label.length > 18 ? `${label.slice(0, 16)}…` : label;
}

const renamingId = ref<string | null>(null);
const renameValue = ref("");
const renameInput = ref<HTMLInputElement[] | HTMLInputElement | null>(null);

async function startRename(level: { id: string; name: string }): Promise<void> {
  if (level.id !== chrome.levelId) {
    await openLevel(level.id);
  }
  renamingId.value = level.id;
  renameValue.value = level.name || level.id;
  await nextTick();
  const el = Array.isArray(renameInput.value) ? renameInput.value[0] : renameInput.value;
  el?.focus();
  el?.select();
}

function commitRename(): void {
  if (renamingId.value !== null) {
    renameLevel(renameValue.value);
  }
  renamingId.value = null;
}
</script>

<template>
  <aside class="sidebar">
    <div class="header">
      <span>{{ t("sidebar.levels") }}</span>
      <button
        class="icon-btn"
        :title="t('sidebar.refresh')"
        :aria-label="t('sidebar.refresh')"
        @click="refreshLevelList()"
      >
        <Icon name="refresh" :size="14" />
      </button>
    </div>
    <nav :aria-label="t('sidebar.levels')">
      <ul class="list">
        <li v-for="level in chrome.levels" :key="level.id">
          <input
            v-if="renamingId === level.id"
            ref="renameInput"
            v-model="renameValue"
            class="rename-input"
            @keydown.enter="commitRename()"
            @keydown.esc="renamingId = null"
            @blur="commitRename()"
          />
          <button
            v-else
            class="level-btn"
            :class="{ active: level.id === chrome.levelId }"
            :aria-current="level.id === chrome.levelId ? 'true' : undefined"
            :title="`${level.name || level.id} — ${t('sidebar.rename.hint')}`"
            @click="openLevel(level.id)"
            @dblclick="startRename(level)"
          >
            {{ displayName(level) }}
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

.rename-input {
  width: 100%;
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
