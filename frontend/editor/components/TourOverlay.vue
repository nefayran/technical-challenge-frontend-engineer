<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";

import { CONFIG } from "../config.ts";
import { t } from "../i18n.ts";
import KbdText from "./KbdText.vue";

// Spotlight tour: each step targets a [data-tour] anchor. The highlight box
// carves a hole in the backdrop via a huge box-shadow; the card flips above
// or below the target depending on the free space.
const emit = defineEmits<{ close: [] }>();

// "welcome" has no anchor and renders as a centered intro card; "help" points
// at the ? button so replaying the tour is discoverable.
const STEP_KEYS = [
  "welcome",
  "tools",
  "palette",
  "history",
  "canvas",
  "sidebar",
  "status",
  "play",
  "theme",
  "help",
] as const;

const stepIndex = ref(0);
const target = ref<{ x: number; y: number; w: number; h: number } | null>(null);
const nextButton = ref<HTMLButtonElement | null>(null);

const stepKey = computed(() => STEP_KEYS[stepIndex.value]!);
const isLast = computed(() => stepIndex.value === STEP_KEYS.length - 1);

const PADDING = CONFIG.tour.highlightPaddingPx;
const CARD_WIDTH = CONFIG.tour.cardWidthPx;
const CARD_GAP = CONFIG.tour.cardGapPx;

function measure(): void {
  const el = document.querySelector(`[data-tour="${stepKey.value}"]`);
  if (el === null) {
    target.value = null;
    return;
  }
  const rect = el.getBoundingClientRect();
  target.value = {
    x: rect.left - PADDING,
    y: rect.top - PADDING,
    w: rect.width + PADDING * 2,
    h: rect.height + PADDING * 2,
  };
}

const highlightStyle = computed(() => {
  const box = target.value;
  if (box === null) {
    return { display: "none" };
  }
  return {
    left: `${box.x}px`,
    top: `${box.y}px`,
    width: `${box.w}px`,
    height: `${box.h}px`,
  };
});

const CARD_EST_HEIGHT = CONFIG.tour.cardEstimatedHeightPx;

const cardStyle = computed(() => {
  const box = target.value;
  // No anchor (welcome step) — a centered card.
  if (box === null) {
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  }
  // A target that fills most of the screen (the canvas): center the card on
  // it instead of trying to squeeze the card off-viewport.
  if (box.h > window.innerHeight * CONFIG.tour.centerCardTargetFraction) {
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  }
  const left = Math.max(
    CARD_GAP,
    Math.min(box.x, window.innerWidth - CARD_WIDTH - CARD_GAP),
  );
  const below = box.y + box.h + CARD_GAP;
  if (below + CARD_EST_HEIGHT <= window.innerHeight) {
    return { left: `${left}px`, top: `${below}px` };
  }
  const above = box.y - CARD_GAP - CARD_EST_HEIGHT;
  if (above >= CARD_GAP) {
    return { left: `${left}px`, bottom: `${window.innerHeight - box.y + CARD_GAP}px` };
  }
  // Neither side fits — clamp inside the viewport next to the target.
  return {
    left: `${left}px`,
    top: `${Math.max(CARD_GAP, window.innerHeight - CARD_EST_HEIGHT - CARD_GAP)}px`,
  };
});

async function goTo(index: number): Promise<void> {
  if (index < 0) {
    return;
  }
  if (index >= STEP_KEYS.length) {
    emit("close");
    return;
  }
  stepIndex.value = index;
  await nextTick();
  measure();
  nextButton.value?.focus();
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    emit("close");
  } else if (event.key === "ArrowRight" || event.key === "Enter") {
    event.preventDefault();
    void goTo(stepIndex.value + 1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    void goTo(stepIndex.value - 1);
  }
}

onMounted(() => {
  measure();
  nextButton.value?.focus();
  window.addEventListener("resize", measure);
  window.addEventListener("keydown", onKeyDown, true);
});

onUnmounted(() => {
  window.removeEventListener("resize", measure);
  window.removeEventListener("keydown", onKeyDown, true);
});
</script>

<template>
  <div class="tour" role="dialog" aria-modal="true" :aria-label="t(`tour.${stepKey}.title`)">
    <div v-if="target === null" class="backdrop" />
    <div class="highlight" :style="highlightStyle" />
    <div class="card" :style="cardStyle">
      <div class="card-header">
        <h3>{{ t(`tour.${stepKey}.title`) }}</h3>
        <span class="counter">{{ stepIndex + 1 }}/{{ STEP_KEYS.length }}</span>
      </div>
      <p><KbdText :text="t(`tour.${stepKey}.body`)" /></p>
      <div class="controls">
        <button class="skip" @click="emit('close')">{{ t("tour.skip") }}</button>
        <div class="nav">
          <button :disabled="stepIndex === 0" @click="goTo(stepIndex - 1)">
            {{ t("tour.prev") }}
          </button>
          <button ref="nextButton" class="active" @click="goTo(stepIndex + 1)">
            {{ isLast ? t("tour.done") : t("tour.next") }}
          </button>
        </div>
      </div>
      <div class="dots" aria-hidden="true">
        <span
          v-for="(key, index) in STEP_KEYS"
          :key="key"
          class="dot"
          :class="{ on: index === stepIndex }"
          @click="goTo(index)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tour {
  position: fixed;
  inset: 0;
  z-index: var(--z-conflict);
}

.backdrop {
  position: fixed;
  inset: 0;
  background: var(--color-backdrop);
}

.highlight {
  position: fixed;
  border: var(--border-width) solid var(--color-accent);
  box-shadow: 0 0 0 100vmax var(--color-backdrop);
  pointer-events: none;
  transition: all 0.18s ease;
}

.card {
  position: fixed;
  width: var(--size-tour-card);
  background: var(--color-bg-surface);
  border: var(--border-width) solid var(--color-border-strong);
  padding: var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.card h3 {
  margin: 0;
  font-size: var(--font-size-md);
  text-transform: uppercase;
  letter-spacing: var(--font-tracking-wide);
}

.counter {
  color: var(--color-text-faint);
  font-size: var(--font-size-sm);
}

.card p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-md);
  line-height: 1.5;
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
}

.nav {
  display: flex;
  gap: var(--space-sm);
}

.skip {
  border-color: transparent;
  color: var(--color-text-dim);
}

.dots {
  display: flex;
  gap: var(--space-sm);
  justify-content: center;
}

.dot {
  width: var(--space-sm);
  height: var(--space-sm);
  background: var(--color-border-control);
  cursor: pointer;
}

.dot.on {
  background: var(--color-accent);
}
</style>
