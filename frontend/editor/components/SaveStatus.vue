<script setup lang="ts">
import { computed } from "vue";

import { t } from "../i18n.ts";
import { chrome } from "../store.ts";

const COLORS: Record<string, string> = {
  loading: "var(--color-neutral)",
  synced: "var(--color-accent)",
  dirty: "var(--color-warning)",
  saving: "var(--color-info)",
  conflict: "var(--color-danger)",
  offline: "var(--color-danger)",
  error: "var(--color-danger)",
};

const text = computed(() => t(`status.${chrome.syncState}`));
const color = computed(() => COLORS[chrome.syncState] ?? COLORS.error!);
</script>

<template>
  <div
    class="status"
    role="status"
    aria-live="polite"
    :title="t('status.title', { id: chrome.levelId, version: chrome.version })"
  >
    <span class="dot" :style="{ background: color }" aria-hidden="true" />
    {{ text }}
    <span class="version">v{{ chrome.version }}</span>
  </div>
</template>

<style scoped>
.status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-md);
  font-size: var(--font-size-md);
  color: var(--color-text-muted);
}

.dot {
  width: var(--size-dot);
  height: var(--size-dot);
  border-radius: 50%;
}

.version {
  color: var(--color-text-faint);
}
</style>
