/**
 * Progress model for the ingest pipeline.
 *
 * Each stage owns a slice of 0–100. Progress is only persisted (and therefore
 * only pushed to the dashboard over SSE) when it crosses a 10% step, so a
 * 2,000-chunk document causes ~10 DB writes instead of 2,000.
 */
export const STAGES = {
  download: [0, 10],
  parse: [10, 20],
  clean: [20, 30],
  chunk: [30, 40],
  embed: [40, 90],
  store: [90, 100],
} as const satisfies Record<string, readonly [number, number]>;

export type Stage = keyof typeof STAGES;

export const PROGRESS_STEP = 10;

/** Maps a stage-local fraction (0–1) to overall percent (0–100). */
export function stagePercent(stage: Stage, fraction: number): number {
  const [start, end] = STAGES[stage];
  const clamped = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  return start + (end - start) * clamped;
}

/** Rounds down to the nearest 10% step. */
export function toStep(percent: number): number {
  return Math.min(100, Math.max(0, Math.floor(percent / PROGRESS_STEP) * PROGRESS_STEP));
}

/**
 * Returns a reporter that calls `persist` only when the 10% step increases.
 * Progress never goes backwards within one run.
 */
export function createProgressReporter(
  persist: (step: number, stage: Stage) => Promise<void>,
  initialStep = 0,
) {
  let current = initialStep;
  return async function report(stage: Stage, fraction: number): Promise<void> {
    const step = toStep(stagePercent(stage, fraction));
    if (step <= current) return;
    current = step;
    await persist(step, stage);
  };
}
