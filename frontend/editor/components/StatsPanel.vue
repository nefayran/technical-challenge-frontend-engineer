<script setup lang="ts">
import { ref, watch } from "vue";

import { t } from "../i18n.ts";
import { countCells } from "../core/grid.ts";
import { gridRef, redrawTick } from "../store.ts";

const counts = ref({ walls: 0, pellets: 0, powerPellets: 0, players: 0, ghosts: 0 });
const size = ref("");

let timer: ReturnType<typeof setTimeout> | null = null;

// Counting is O(cells); on a 1000x1000 board that is a full 1MB scan, so it
// runs debounced instead of per stroke-move frame.
watch(
  redrawTick,
  () => {
    if (timer !== null) {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      const grid = gridRef.value;
      if (grid !== null) {
        counts.value = countCells(grid);
        size.value = `${grid.width}×${grid.height}`;
      }
    }, 300);
  },
  { immediate: true },
);
</script>

<template>
  <div class="stats" role="status">
    <span>{{ t("stats.size") }}: {{ size }}</span>
    <span>{{ t("stats.walls") }}: {{ counts.walls }}</span>
    <span>{{ t("stats.pellets") }}: {{ counts.pellets }}</span>
    <span>{{ t("stats.power") }}: {{ counts.powerPellets }}</span>
    <span>{{ t("stats.players") }}: {{ counts.players }}</span>
    <span>{{ t("stats.ghosts") }}: {{ counts.ghosts }}</span>
    <span v-if="counts.players === 0" class="warning">{{ t("stats.noPlayer") }}</span>
  </div>
</template>

<style scoped>
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  padding: var(--space-sm) var(--space-lg);
  border-top: var(--border-width) solid var(--color-border);
  background: var(--color-bg-panel);
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.warning {
  color: var(--color-warning);
}
</style>
