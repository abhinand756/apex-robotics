"use client";

import { useEffect, useRef } from "react";

const TAU = Math.PI * 2;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const grow = (t: number, a: number, b: number) => ease(clamp01((t - a) / (b - a)));
const pulse = (t: number, a: number, b: number) =>
  Math.sin(clamp01((t - a) / (b - a)) * Math.PI);

const CX = 160;
const FLOOR = 368;

interface Pt {
  x: number;
  y: number;
}

const J = {
  athl: { x: -56, y: 352 },
  athr: { x: 56, y: 352 },
  kneeL: { x: -52, y: 268 },
  kneeR: { x: 52, y: 268 },
  hipL: { x: -48, y: 208 },
  hipR: { x: 48, y: 208 },
  pelv: { x: CX, y: 212 },
  waist: { x: CX, y: 182 },
  chesT: { x: CX, y: 130 },
  chesB: { x: CX, y: 182 },
  shouL: { x: CX - 62, y: 140 },
  shouR: { x: CX + 62, y: 140 },
  elboL: { x: CX - 72, y: 202 },
  elboR: { x: CX + 72, y: 202 },
  handL: { x: CX - 64, y: 260 },
  handR: { x: CX + 64, y: 260 },
  neck: { x: CX, y: 122 },
} as const;

/* bottom-up build segments — from → to grow across a time window */
const SEG: { from: Pt; to: Pt; w: [number, number]; lw: number }[] = [
  { from: { x: -52, y: FLOOR }, to: J.athl, w: [0.1, 0.18], lw: 6 },
  { from: { x: 52, y: FLOOR }, to: J.athr, w: [0.1, 0.18], lw: 6 },
  { from: J.kneeL, to: J.athl, w: [0.2, 0.3], lw: 5 },
  { from: J.kneeR, to: J.athr, w: [0.2, 0.3], lw: 5 },
  { from: J.hipL, to: J.kneeL, w: [0.32, 0.42], lw: 5.5 },
  { from: J.hipR, to: J.kneeR, w: [0.32, 0.42], lw: 5.5 },
  { from: { x: -52, y: 210 }, to: { x: 52, y: 210 }, w: [0.46, 0.54], lw: 14 },
  { from: J.pelv, to: J.waist, w: [0.56, 0.63], lw: 13 },
  { from: J.shouL, to: J.elboL, w: [0.68, 0.76], lw: 5 },
  { from: J.shouR, to: J.elboR, w: [0.68, 0.76], lw: 5 },
  { from: J.elboL, to: J.handL, w: [0.8, 0.87], lw: 4 },
  { from: J.elboR, to: J.handR, w: [0.8, 0.87], lw: 4 },
  { from: J.chesT, to: J.neck, w: [0.88, 0.93], lw: 7 },
];

const HEAD = { x: 88, y: 74, w: 144, h: 48, r: 14 };

const BOLTS: { p: Pt; at: number }[] = [
  { p: J.athl, at: 0.19 },
  { p: J.athr, at: 0.19 },
  { p: J.kneeL, at: 0.32 },
  { p: J.kneeR, at: 0.32 },
  { p: J.hipL, at: 0.45 },
  { p: J.hipR, at: 0.45 },
  { p: J.shouL, at: 0.78 },
  { p: J.shouR, at: 0.78 },
  { p: J.elboL, at: 0.89 },
  { p: J.elboR, at: 0.89 },
  { p: J.neck, at: 0.95 },
];

const WELDS: Pt[] = [
  J.athl,
  J.athr,
  J.kneeL,
  J.kneeR,
  J.hipL,
  J.hipR,
  J.shouL,
  J.shouR,
  J.neck,
];

/* Lined robotic structure loader: build → bolt → weld → power-on */
export function BootLoader() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pctRef = useRef<HTMLSpanElement | null>(null);
  const phaseRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 320;
    const H = 420;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const start = performance.now();
    const DURATION = 2150;
    let raf = 0;

    const drawSeg = (a: Pt, b: Pt, g: number, lw: number) => {
      if (g <= 0) return;
      const x = lerp(a.x, b.x, g);
      const y = lerp(a.y, b.y, g);
      ctx.strokeStyle = "rgba(0,229,255,0.9)";
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.strokeStyle = "rgba(190,240,252,0.35)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const frame = (now: number) => {
      const elapsed = now - start;
      const t = clamp01(elapsed / DURATION);
      const hold = clamp01((elapsed - DURATION * 0.94) / 1000);
      const breathe = Math.sin(now * 0.0011) * 1.3 * hold;

      ctx.clearRect(0, 0, W, H);

      /* blueprint grid */
      ctx.strokeStyle = "rgba(80,140,160,0.13)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y <= H; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      /* datum rails */
      ctx.strokeStyle = "rgba(0,229,255,0.4)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(16, FLOOR);
      ctx.lineTo(W - 16, FLOOR);
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,229,255,0.16)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(16, FLOOR + 14);
      ctx.lineTo(W - 16, FLOOR + 14);
      ctx.stroke();

      /* blueprint silhouette of the final structure */
      const ghostA = 0.55 * (1 - clamp01((t - 0.24) / 0.35));
      if (ghostA > 0.02) {
        ctx.save();
        ctx.strokeStyle = `rgba(0,229,255,${ghostA})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        for (const [a, b] of [
          [J.kneeL, J.athl],
          [J.kneeR, J.athr],
          [J.hipL, J.kneeL],
          [J.hipR, J.kneeR],
          [J.pelv, { x: CX - 52, y: 208 }],
          [J.pelv, { x: CX + 52, y: 208 }],
          [J.pelv, J.waist],
          [J.waist, J.chesT],
          [J.shouL, J.elboL],
          [J.shouR, J.elboR],
          [J.elboL, J.handL],
          [J.elboR, J.handR],
          [J.chesT, J.neck],
        ] as [Pt, Pt][]) {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
        ctx.strokeStyle = `rgba(0,229,255,${ghostA * 0.8})`;
        rr(ctx, HEAD.x, HEAD.y, HEAD.w, HEAD.h, HEAD.r);
        ctx.stroke();
        ctx.strokeStyle = `rgba(0,229,255,${ghostA * 0.5})`;
        ctx.beginPath();
        ctx.moveTo(CX - 44, J.chesT.y);
        ctx.lineTo(CX + 44, J.chesT.y);
        ctx.lineTo(CX + 58, J.chesB.y);
        ctx.lineTo(CX - 58, J.chesB.y);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(0, breathe);

      /* pelvis band + spine gimbal built from the floor up */
      const pelvG = grow(t, 0.46, 0.54);
      if (pelvG > 0) {
        const half = lerp(52, 0, pelvG);
        ctx.fillStyle = "rgba(0,229,255,0.06)";
        ctx.strokeStyle = "rgba(0,229,255,0.85)";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(CX - half, J.pelv.y - 8);
        ctx.lineTo(CX + half, J.pelv.y - 8);
        ctx.lineTo(CX + 52, J.pelv.y + 8);
        ctx.lineTo(CX - 52, J.pelv.y + 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      const waistG = grow(t, 0.56, 0.63);
      if (waistG > 0) {
        ctx.strokeStyle = "rgba(0,229,255,0.9)";
        ctx.lineWidth = 13;
        ctx.beginPath();
        ctx.moveTo(CX, J.pelv.y + 6);
        ctx.lineTo(CX, lerp(J.pelv.y + 6, J.waist.y, waistG));
        ctx.stroke();
        ctx.strokeStyle = "rgba(12,28,36,1)";
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(CX, J.pelv.y + 6);
        ctx.lineTo(CX, lerp(J.pelv.y + 6, J.waist.y, waistG));
        ctx.stroke();
      }

      /* chest */
      const chestG = grow(t, 0.62, 0.72);
      if (chestG > 0) {
        const top = lerp(J.waist.y + 4, J.chesT.y, chestG);
        const halfTop = lerp(58, 44, chestG);
        ctx.fillStyle = "rgba(0,229,255,0.06)";
        ctx.strokeStyle = "rgba(0,229,255,0.85)";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(CX - halfTop, top);
        ctx.lineTo(CX + halfTop, top);
        ctx.lineTo(CX + 58, J.waist.y);
        ctx.lineTo(CX - 58, J.waist.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = "rgba(0,229,255,0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(CX, top + 5);
        ctx.lineTo(CX, J.waist.y - 4);
        ctx.stroke();
      }

      /* foot pods */
      for (const end of [J.athl, J.athr]) {
        const g = grow(t, 0.1, 0.18);
        if (g <= 0) continue;
        ctx.fillStyle = "rgba(0,229,255,0.07)";
        ctx.strokeStyle = "rgba(0,229,255,0.8)";
        ctx.lineWidth = 2;
        const fy = lerp(FLOOR + 20, end.y, g);
        rr(ctx, end.x - 24, fy - 7, 48, 16, 6);
        ctx.fill();
        ctx.stroke();
      }

      /* linear structural segments */
      for (const s of SEG) {
        drawSeg(s.from, s.to, grow(t, s.w[0], s.w[1]), s.lw);
      }

      /* head shell */
      const headG = grow(t, 0.9, 0.97);
      if (headG > 0) {
        const gy = lerp(J.neck.y - 2, HEAD.y, headG);
        ctx.fillStyle = "rgba(0,229,255,0.05)";
        ctx.strokeStyle = "rgba(0,229,255,0.85)";
        ctx.lineWidth = 2.2;
        rr(ctx, HEAD.x, gy, HEAD.w, HEAD.h, HEAD.r);
        ctx.fill();
        ctx.stroke();
        /* ear mounts */
        ctx.strokeStyle = "rgba(0,229,255,0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(HEAD.x, gy + 18);
        ctx.lineTo(81, gy + 21);
        ctx.lineTo(81, gy + 30);
        ctx.moveTo(HEAD.x + HEAD.w, gy + 18);
        ctx.lineTo(239, gy + 21);
        ctx.lineTo(239, gy + 30);
        ctx.stroke();
        /* antenna */
        ctx.strokeStyle = "rgba(0,229,255,0.85)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(CX + 26, gy + 4);
        ctx.lineTo(CX + 31, gy - 24 + breathe);
        ctx.stroke();
        ctx.fillStyle = "rgba(0,229,255,0.95)";
        ctx.beginPath();
        ctx.arc(CX + 31.5, gy - 26 + breathe, 3.2, 0, TAU);
        ctx.fill();
      }

      /* claws on hands after arms land */
      if (t > 0.88) {
        const open = 0.3 + 0.5 * (1 - smooth2(clamp01((t - 0.88) / 0.1)));
        drawClaw(ctx, J.handL.x, J.handL.y, open);
        drawClaw(ctx, J.handR.x, J.handR.y, open);
      }

      /* bolts torque in at the end */
      const torque = clamp01((t - 0.95) / 0.07);
      for (const b of BOLTS) {
        if (t < b.at) continue;
        const spin = torque * TAU * 2.4 + now * 0.012;
        drawScrew(ctx, b.p.x, b.p.y, 6, spin, t > 0.985);
      }

      /* weld flashes tour the frame */
      const wBase = 1.0;
      for (let i = 0; i < WELDS.length; i++) {
        const c = pulse(t, wBase + i * 0.028, wBase + i * 0.028 + 0.07);
        if (c <= 0.02) continue;
        const p = WELDS[i];
        ctx.save();
        ctx.strokeStyle = `rgba(255,190,110,${c})`;
        ctx.lineWidth = 1.6;
        for (let k = 0; k < 7; k++) {
          const a = k * 0.898 + 0.3;
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(a) * 5, p.y + Math.sin(a) * 5);
          ctx.lineTo(p.x + Math.cos(a) * (5 + 13 * c), p.y + Math.sin(a) * (5 + 13 * c));
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(255,250,235,${c})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.4 * c, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      /* power-on: visor lights + energy pulse rising */
      const power = clamp01((t - 0.99) / 0.05);
      if (power > 0.01) {
        ctx.save();
        const vg = ctx.createLinearGradient(94, 98, 226, 98);
        vg.addColorStop(0, "#00303e");
        vg.addColorStop(0.5, "#00e5ff");
        vg.addColorStop(1, "#00303e");
        ctx.fillStyle = vg;
        rr(ctx, 94, 96, 132, 9, 4.5);
        ctx.fill();
        ctx.strokeStyle = `rgba(0,229,255,${0.7 * power})`;
        ctx.lineWidth = 1.2;
        rr(ctx, 94, 96, 132, 9, 4.5);
        ctx.stroke();
        const scanx = lerp(100, 220, clamp01((now * 0.0002) % 1));
        ctx.fillStyle = "rgba(240,254,255,0.95)";
        ctx.fillRect(scanx - 6, 97.5, 12, 6);
        ctx.restore();

        const e = fmod(now * 0.0004, 1.05) - 0.02;
        const ey = FLOOR - e * 300;
        const ea = Math.max(0, 0.7 * power * (1 - Math.abs(e - 0.5) * 2));
        ctx.strokeStyle = `rgba(0,229,255,${ea})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(CX - 26, ey);
        ctx.lineTo(CX + 26, ey);
        ctx.stroke();
      }

      ctx.restore();

      /* registration corners */
      ctx.strokeStyle = "rgba(0,229,255,0.5)";
      ctx.lineWidth = 1.2;
      const reg = (x: number, y: number, dx: number, dy: number) => {
        ctx.beginPath();
        ctx.moveTo(x + dx * 12, y);
        ctx.lineTo(x, y);
        ctx.lineTo(x, y + dy * 12);
        ctx.stroke();
      };
      reg(30, 30, 1, 1);
      reg(W - 30, 30, -1, 1);
      reg(30, H - 26, 1, -1);
      reg(W - 30, H - 26, -1, -1);

      if (pctRef.current) {
        const v = `${String(Math.round(t * 100)).padStart(3, "0")}%`;
        if (pctRef.current.textContent !== v) pctRef.current.textContent = v;
      }
      if (phaseRef.current) {
        const ph = t < 0.94 ? "FABRICATING CHASSIS" : t < 0.99 ? "ARC WELDING" : "POWERING VISOR";
        if (phaseRef.current.textContent !== ph) phaseRef.current.textContent = ph;
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="h-[300px] w-auto select-none"
      />
      <div className="mt-4 flex w-[280px] items-center justify-between font-mono text-[10px] tracking-[0.24em]">
        <span ref={pctRef} className="text-signal">
          000%
        </span>
        <span ref={phaseRef} className="shimmer-line text-mute">
          FABRICATING CHASSIS
        </span>
        <span className="blink-caret text-signal">▌</span>
      </div>
    </div>
  );
}

const smooth2 = (x: number) => x * x * (3 - 2 * x);

function drawScrew(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rot: number,
  lit = false
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = lit ? "rgba(0,229,255,0.16)" : "rgba(120,165,182,0.16)";
  ctx.strokeStyle = lit ? "rgba(0,229,255,0.9)" : "rgba(110,150,168,0.6)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = lit ? "rgba(220,250,255,0.95)" : "rgba(150,195,210,0.8)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, 0);
  ctx.lineTo(r * 0.55, 0);
  ctx.stroke();
  ctx.restore();
}

function drawClaw(ctx: CanvasRenderingContext2D, x: number, y: number, open: number) {
  const spread = 0.3 + open;
  ctx.strokeStyle = "rgba(0,229,255,0.85)";
  ctx.lineWidth = 2.6;
  for (const d of [-1, 1] as const) {
    const a = Math.PI / 2 + d * spread;
    const t1x = x + Math.cos(a) * 12;
    const t1y = y + Math.sin(a) * 12;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(t1x, t1y);
    ctx.stroke();
  }
}

function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function fmod(a: number, n: number) {
  return a - Math.floor(a / n) * n;
}