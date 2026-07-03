<script setup lang="ts">
import { computed } from "vue";

// Renders a translated string with [[Key]] markers as <kbd> chips —
// structured markers instead of v-html, so no injection surface.
const props = defineProps<{ text: string }>();

const parts = computed(() => {
  const result: Array<{ kbd: boolean; value: string }> = [];
  const pattern = /\[\[(.+?)\]\]/g;
  let last = 0;
  for (const match of props.text.matchAll(pattern)) {
    if (match.index! > last) {
      result.push({ kbd: false, value: props.text.slice(last, match.index) });
    }
    result.push({ kbd: true, value: match[1]! });
    last = match.index! + match[0].length;
  }
  if (last < props.text.length) {
    result.push({ kbd: false, value: props.text.slice(last) });
  }
  return result;
});
</script>

<template>
  <span>
    <template v-for="(part, index) in parts" :key="index">
      <kbd v-if="part.kbd">{{ part.value }}</kbd>
      <template v-else>{{ part.value }}</template>
    </template>
  </span>
</template>
