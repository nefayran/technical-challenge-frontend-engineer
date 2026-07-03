<script setup lang="ts">
// Hand-drawn 16x16 line icons on currentColor — no icon-font or emoji, so
// they follow the theme and render identically across platforms.
type IconName = "sun" | "moon" | "refresh" | "undo" | "redo" | "close";

const props = defineProps<{ name: IconName; size?: number }>();

const PATHS: Record<IconName, string> = {
  sun: "M8 5.2a2.8 2.8 0 1 0 0 5.6a2.8 2.8 0 0 0 0-5.6M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M13 3l-1.4 1.4M4.4 11.6L3 13",
  moon: "M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8A5.6 5.6 0 1 0 13.2 9.6",
  refresh: "M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 1.5v3h-3",
  undo: "M5.5 3.5L2.5 6.5l3 3M2.5 6.5H10a3.5 3.5 0 0 1 0 7H7",
  redo: "M10.5 3.5l3 3l-3 3M13.5 6.5H6a3.5 3.5 0 0 0 0 7h3",
  close: "M3.5 3.5l9 9M12.5 3.5l-9 9",
};
</script>

<template>
  <svg
    :width="props.size ?? 16"
    :height="props.size ?? 16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.3"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="PATHS[props.name]" />
  </svg>
</template>

<style scoped>
svg {
  display: block;
}
</style>
