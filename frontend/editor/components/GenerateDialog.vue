<script setup lang="ts">
import { onMounted, ref } from "vue";

import { CONFIG } from "../config.ts";
import { t } from "../i18n.ts";
import { newGeneratedLevel } from "../store.ts";

const emit = defineEmits<{ close: [] }>();

const seed = ref(1);
const size = ref<number>(CONFIG.generate.defaultSize);
const busy = ref(false);
const seedInput = ref<HTMLInputElement | null>(null);

onMounted(() => {
  seedInput.value?.focus();
});

async function generate(): Promise<void> {
  busy.value = true;
  const clamped = Math.min(
    CONFIG.generate.maxSize,
    Math.max(CONFIG.generate.minSize, Math.round(size.value)),
  );
  await newGeneratedLevel(Math.round(seed.value), clamped);
  busy.value = false;
  emit("close");
}
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div class="dialog" role="dialog" aria-modal="true" :aria-label="t('generate.title')">
      <h3>{{ t("generate.title") }}</h3>
      <p class="hint">{{ t("generate.hint") }}</p>
      <label>
        {{ t("generate.seed") }}
        <input ref="seedInput" v-model.number="seed" type="number" @keydown.enter="generate()" />
      </label>
      <label>
        {{ t("generate.size", { min: CONFIG.generate.minSize, max: CONFIG.generate.maxSize }) }}
        <input
          v-model.number="size"
          type="number"
          :min="CONFIG.generate.minSize"
          :max="CONFIG.generate.maxSize"
          @keydown.enter="generate()"
        />
      </label>
      <div class="dialog-actions">
        <button @click="emit('close')">{{ t("generate.cancel") }}</button>
        <button class="active" :disabled="busy" @click="generate()">
          {{ busy ? t("generate.running") : t("generate.run") }}
        </button>
      </div>
    </div>
  </div>
</template>
