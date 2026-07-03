<script setup lang="ts">
import { onMounted, ref } from "vue";

import { t } from "../i18n.ts";
import { chrome, resolveConflictKeepMine, resolveConflictTakeTheirs } from "../store.ts";

const firstChoice = ref<HTMLButtonElement | null>(null);

onMounted(() => {
  firstChoice.value?.focus();
});
</script>

<template>
  <div class="dialog-backdrop conflict">
    <div class="dialog" role="alertdialog" aria-modal="true" :aria-label="t('conflict.title')">
      <h3>{{ t("conflict.title") }}</h3>
      <p>{{ t("conflict.body", { version: chrome.conflict?.version ?? "?" }) }}</p>
      <div class="choices">
        <button ref="firstChoice" @click="resolveConflictTakeTheirs()">
          <strong>{{ t("conflict.theirs") }}</strong>
          <span>{{ t("conflict.theirs.hint") }}</span>
        </button>
        <button @click="resolveConflictKeepMine()">
          <strong>{{ t("conflict.mine") }}</strong>
          <span>{{ t("conflict.mine.hint") }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.conflict {
  z-index: var(--z-conflict);
}

.conflict .dialog {
  border-color: var(--color-danger);
  max-width: var(--size-dialog-wide);
}

.dialog p {
  margin: 0;
}

.choices {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.choices button {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xs);
  text-align: left;
  padding: var(--space-md) var(--space-lg);
}

.choices span {
  font-size: var(--font-size-sm);
  color: var(--color-text-dim);
}
</style>
