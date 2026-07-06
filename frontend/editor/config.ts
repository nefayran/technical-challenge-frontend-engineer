// Every tunable in one place. Values are starting points, not laws — tweak
// here instead of hunting through modules.

export const CONFIG = {
  history: {
    // Cap on retained undo diffs (6 bytes per touched cell). Oldest strokes
    // drop first once exceeded.
    byteBudget: 64 * 1024 * 1024,
  },
  camera: {
    minScale: 0.5,
    maxScale: 48,
    fitPaddingPx: 16,
    // Fraction of the viewport allowed to pan past the board edge.
    panOverscroll: 0.8,
    wheelZoomFactor: 1.0015,
  },
  render: {
    // Below this px-per-cell, blit the 1px/cell overview bitmap instead of
    // drawing glyphs.
    glyphMinScale: 4,
    gridLineMinScale: 10,
    spawnArrowMinScale: 14,
  },
  sync: {
    apiBase: "http://127.0.0.1:8000",
    // Idle time after the last edit before an autosave fires.
    saveDebounceMs: 800,
    // Retry backoff while the backend is unreachable.
    retryBaseMs: 1000,
    retryMaxMs: 15000,
    requestTimeoutMs: 20000,
    // Live pull: while synced, the current level is re-checked at this
    // interval and remote updates are applied in place.
    pollIntervalMs: 5000,
    levelListRefreshMs: 15000,
  },
  draft: {
    // Local crash-recovery draft (localStorage) write throttle.
    throttleMs: 2000,
    keyPrefix: "maze-editor-draft:",
  },
  playtest: {
    // Engine integration step denominator: 1/8 cell per tick, as in the game.
    stepDenominator: 8,
    cameraFollowLerp: 0.15,
  },
  tour: {
    // Spotlight padding around the target and card geometry, in px. The card
    // width must match tokens.size.tourCard.
    highlightPaddingPx: 6,
    cardWidthPx: 320,
    cardGapPx: 12,
    cardEstimatedHeightPx: 240,
    // Targets taller than this viewport fraction get a centered card.
    centerCardTargetFraction: 0.6,
  },
  newLevel: {
    defaultWidth: 28,
    defaultHeight: 31,
    minSize: 1,
    maxSize: 1000,
  },
  generate: {
    minSize: 15,
    maxSize: 1000,
    defaultSize: 31,
  },
} as const;
