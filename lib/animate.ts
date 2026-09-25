export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeOutCubic(t: number): number {
  const x = 1 - clamp01(t);
  return 1 - x * x * x;
}

export function easeOutBack(t: number, overshoot = 1.4): number {
  const c1 = overshoot;
  const c3 = c1 + 1;
  const x = clamp01(t) - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - clamp01(t), 4);
}

/**
 * Progress within a window [a,b], eased with smooth start/end.
 * Returns 0 before a, 1 at/after b.
 */
export function seg(p: number, a: number, b: number, _edge = 0.08): number {
  void _edge;
  return easeInOutCubic(clamp01((p - a) / (b - a)));
}

/** Map the portion of p inside [a,b] to [0,1] with eased edges. */
export function phase(p: number, a: number, b: number, edge = 0.1): number {
  return seg(p, a, b, edge);
}

/** Remap a range [in0,in1] into [out0,out1] and clamp. */
export function mapRange(v: number, in0: number, in1: number, out0: number, out1: number): number {
  const t = clamp01((v - in0) / (in1 - in0));
  return lerp(out0, out1, t);
}

export function fmtPct(v: number): string {
  return `${Math.round(clamp01(v) * 100).toString().padStart(3, " ")}%`;
}