function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function clamp01(t: number): number {
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.min(1, t));
}

/** Blend from hexA (t=0) to hexB (t=1), returning an "rgb(r, g, b)" string. */
export function mixColor(hexA: string, hexB: string, t: number): string {
  const clamped = clamp01(t);
  const [ar, ag, ab] = hexToRgb(hexA);
  const [br, bg, bb] = hexToRgb(hexB);
  const r = Math.round(ar + (br - ar) * clamped);
  const g = Math.round(ag + (bg - ag) * clamped);
  const b = Math.round(ab + (bb - ab) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}
