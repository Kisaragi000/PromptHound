/** Highest weight the LoRA mixer slider goes to */
export const MAX_WEIGHT = 5;

/** Weights the slider snaps to when dragged close to them */
export const SNAP_WEIGHTS = [0.8, 1, 1.5, 1.8, 2, 3, 4, 5];
const SNAP_DISTANCE = 0.07;

/** The snap weight near a dragged value, or the value rounded to hundredths */
export function snapWeight(value: number): number {
  const near = SNAP_WEIGHTS.find((w) => Math.abs(w - value) <= SNAP_DISTANCE);
  return near ?? Math.round(value * 100) / 100;
}
