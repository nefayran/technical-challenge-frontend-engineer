<script setup lang="ts">
import { computed } from "vue";

import { t } from "../i18n.ts";
import { CellCode, type ToolKind } from "../types.ts";
import { chrome, redo, undo } from "../store.ts";

const emit = defineEmits<{ fit: [] }>();

const TOOL_KEYS: Array<{ kind: ToolKind; key: string }> = [
  { kind: "paint", key: "1" },
  { kind: "erase", key: "2" },
  { kind: "line", key: "3" },
  { kind: "rect", key: "4" },
  { kind: "flood", key: "5" },
  { kind: "pan", key: "6" },
];

const tools = computed(() =>
  TOOL_KEYS.map(({ kind, key }) => ({
    kind,
    key,
    label: t(`tool.${kind}`),
    hint: `${t(`tool.${kind}.hint`)} (${key})`,
  })),
);

const palette = computed(() => [
  { code: CellCode.Wall, label: t("block.wall"), swatch: "var(--color-wall)" },
  { code: CellCode.Pellet, label: t("block.pellet"), swatch: "var(--color-pellet)" },
  { code: CellCode.PowerPellet, label: t("block.power"), swatch: "var(--color-power)" },
  { code: CellCode.PlayerRight, label: `${t("block.player")} →`, swatch: "var(--color-player)" },
  { code: CellCode.PlayerLeft, label: `${t("block.player")} ←`, swatch: "var(--color-player)" },
  { code: CellCode.PlayerUp, label: `${t("block.player")} ↑`, swatch: "var(--color-player)" },
  { code: CellCode.PlayerDown, label: `${t("block.player")} ↓`, swatch: "var(--color-player)" },
  { code: CellCode.GhostRight, label: `${t("block.ghost")} →`, swatch: "var(--color-ghost)" },
  { code: CellCode.GhostLeft, label: `${t("block.ghost")} ←`, swatch: "var(--color-ghost)" },
  { code: CellCode.GhostUp, label: `${t("block.ghost")} ↑`, swatch: "var(--color-ghost)" },
  { code: CellCode.GhostDown, label: `${t("block.ghost")} ↓`, swatch: "var(--color-ghost)" },
]);
</script>

<template>
  <div class="toolbar" role="toolbar" :aria-label="t('app.title')">
    <div class="group" role="group">
      <button
        v-for="tool in tools"
        :key="tool.kind"
        :class="{ active: chrome.tool === tool.kind }"
        :aria-pressed="chrome.tool === tool.kind"
        :title="tool.hint"
        @click="chrome.tool = tool.kind"
      >
        {{ tool.label }}
      </button>
    </div>
    <div class="group palette" role="radiogroup">
      <button
        v-for="entry in palette"
        :key="entry.code"
        class="swatch-btn"
        role="radio"
        :aria-checked="chrome.code === entry.code"
        :class="{ active: chrome.code === entry.code }"
        :title="entry.label"
        @click="chrome.code = entry.code"
      >
        <span class="swatch" :style="{ background: entry.swatch }" aria-hidden="true" />
        {{ entry.label }}
      </button>
    </div>
    <div class="group">
      <button
        :disabled="!chrome.canUndo"
        :title="`${t('tool.undo')} (Cmd/Ctrl+Z)`"
        :aria-label="t('tool.undo')"
        @click="undo()"
      >
        ↩︎
      </button>
      <button
        :disabled="!chrome.canRedo"
        :title="`${t('tool.redo')} (Shift+Cmd/Ctrl+Z)`"
        :aria-label="t('tool.redo')"
        @click="redo()"
      >
        ↪︎
      </button>
      <button :title="`${t('tool.fit.hint')} (F)`" @click="emit('fit')">{{ t("tool.fit") }}</button>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  padding: var(--space-md) var(--space-lg);
  border-bottom: var(--border-width) solid var(--color-border);
  background: var(--color-bg-panel);
}

.group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  align-items: center;
}

.palette {
  border-left: var(--border-width) solid var(--color-border-muted);
  border-right: var(--border-width) solid var(--color-border-muted);
  padding: 0 var(--space-lg);
}

.swatch-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--font-size-md);
}

.swatch {
  width: var(--size-swatch);
  height: var(--size-swatch);
  border-radius: var(--radius-sm);
  display: inline-block;
}
</style>
