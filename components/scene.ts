import { clamp01, easeInOutCubic, easeOutQuart, lerp, mapRange, seg, smoothstep } from "@/lib/animate";
import { T } from "@/lib/timeline";

/* ------------------------------------------------------------------ */
/*  small utils                                                        */
/* ------------------------------------------------------------------ */

const TAU = Math.PI * 2;

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

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Node {
  x: number;
  y: number;
  r: number;
  l: number;
}

interface Edge {
  a: number;
  b: number;
  l: number;
  id: number;
}

interface Dust {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  tw: number;
}

interface Spark {
  x: number;
  y: number;
  r: number;
  at: number;
  tw: number;
}

type PartKey = "legs" | "torso" | "arms" | "head" | "core" | "visor";

/* assembly visibility per body part */
interface PoseConfig {
  legs: number;
  torso: number;
  arms: number;
  head: number;
  core: number;
  visor: number;
}

/* a single factory step: d = delivered into place (0..1), bolt = screws
   torquing (0..1), weld = weld flash envelope (0 start, 1 seam sealed) */
interface PartBuild {
  d: number;
  bolt: number;
  weld: number;
  settle: number;
}

/* per-frame robot animation state — articulated joint model */
interface Rig {
  t: number;
  e: PoseConfig;
  assembly: Record<PartKey, PartBuild>;
  breath: number;
  bob: number;
  hipRoll: number;
  lean: number;
  thigh: [number, number];
  knee: [number, number];
  ankle: [number, number];
  hipAb: [number, number];
  shoulder: [number, number];
  elbow: [number, number];
  claw: [number, number];
  headPan: number;
  headTilt: number;
  visorScan: number;
  visorBoost: number;
  corePulse: number;
  coreBoost: number;
  blink: number;
  drop: number;
  tilt: number;
  scale: number;
}

/* ------------------------------------------------------------------ */
/*  Scene                                                              */
/* ------------------------------------------------------------------ */

export class Scene {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private dust: Dust[] = [];
  private nodes: Node[] = [];
  private edges: Edge[] = [];
  private sparks: Spark[] = [];
  private reduced = false;

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
  }

  resize(w: number, h: number, dpr: number, reduced: boolean) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.reduced = reduced;
    const canvas = this.ctx.canvas;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.buildParticles();
    this.buildNodes();
    this.buildSparks();
  }

  /* ---------------- particle generation ---------------- */

  private buildParticles() {
    const rnd = mulberry32(1337);
    const count = this.reduced ? 24 : 120;
    this.dust = [];
    for (let i = 0; i < count; i++) {
      this.dust.push({
        x: rnd() * this.w,
        y: rnd() * this.h,
        z: 0.12 + rnd() * 0.88,
        vx: (rnd() - 0.5) * 0.2,
        vy: -0.04 - rnd() * 0.12,
        tw: rnd() * TAU,
      });
    }
  }

  private buildNodes() {
    const rnd = mulberry32(4242);
    const cx = this.w * 0.5;
    const cy = this.h * 0.4;
    const rx = Math.min(this.w * 0.3, this.h * 0.42);
    const ry = Math.min(this.h * 0.3, this.w * 0.5) * 0.9;
    const count = this.reduced ? 22 : 64;
    this.nodes = [];
    this.edges = [];

    for (let i = 0; i < count; i++) {
      const a = rnd() * TAU;
      const rad = Math.sqrt(rnd()) * 0.92;
      const x = cx + Math.cos(a) * rad * rx;
      const y = cy + Math.sin(a) * rad * ry * 0.9;
      this.nodes.push({ x, y, r: 1.6 + rnd() * 2.2, l: Math.round(rnd() * 3) + 1 });
    }

    for (let i = 0; i < count; i++) {
      const distances = this.nodes
        .map((n, j) => ({ j, d: (n.x - this.nodes[i].x) ** 2 + (n.y - this.nodes[i].y) ** 2 }))
        .filter((d) => d.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3);
      for (const d of distances) {
        const exists = this.edges.some(
          (e) => (e.a === i && e.b === d.j) || (e.a === d.j && e.b === i)
        );
        if (!exists) {
          this.edges.push({
            a: i,
            b: d.j,
            l: Math.sqrt(d.d),
            id: i * 100 + d.j,
          });
        }
      }
    }
  }

  private buildSparks() {
    const rnd = mulberry32(991);
    this.sparks = [];
    for (let i = 0; i < 34; i++) {
      this.sparks.push({
        x: rnd() * this.w * 0.7 + this.w * 0.15,
        y: rnd() * this.h * 0.6 + this.h * 0.14,
        r: 1 + rnd() * 3.2,
        at: rnd(),
        tw: rnd() * TAU,
      });
    }
  }

  /* ---------------- main draw ---------------- */

  draw(p: number, ms: number, speed: number) {
    const ctx = this.ctx;
    const { w, h } = this;

    ctx.clearRect(0, 0, w, h);

    /* background */
    this.drawBackground(ctx, p);

    /* chapter-local values */
    const intro = seg(p, T.intro[0], T.intro[1], 0.06);
    const assemblyT = seg(p, T.assembly[0], T.assembly[1], 0.05);
    const aiT = seg(p, T.ai[0], T.ai[1], 0.05);
    const trainT = seg(p, T.training[0], T.training[1], 0.05);
    const testT = seg(p, T.testing[0], T.testing[1], 0.04);
    const actT = seg(p, T.activation[0], T.activation[1], 0.05);

    /* factory fixtures — 3D scene handles mechanical arms and assembly */
    this.drawBeams(ctx, p, ms);
    this.drawConveyor(ctx, p, ms);
    // 2D mech arms disabled in favor of real 3D articulated industrial arms with laser welding & sparks
    // this.drawMechArms(ctx, p, ms);

    /* robot — now rendered by ManualRobot SVG (manually editable), canvas robot disabled to remove cyan layers */
    void this.drawRobotScene;
    void assemblyT; void aiT; void trainT;

    /* testing chamber overlay — hidden during activation so final reveal is clean */
    if (testT > 0.002 && actT < 0.01) {
      this.drawChamber(ctx, p, ms, testT);
    }

    /* activation bloom */
    if (actT > 0.002) {
      this.drawActivation(ctx, ms, actT);
    }

    /* halo + dust + speed + fog */
    this.drawDust(ctx, ms, p);
    this.drawSpeedLines(ctx, speed);

    /* gpu-ish top sheen */
    const sheen = ctx.createLinearGradient(0, 0, 0, h);
    sheen.addColorStop(0, `rgba(0,0,0,${0.24 - intro * 0.1})`);
    sheen.addColorStop(0.18, "rgba(0,0,0,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);
  }

  /* ---------------- background + floor ---------------- */

  private drawBackground(ctx: CanvasRenderingContext2D, p: number) {
    const { w, h } = this;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#05070a");
    g.addColorStop(0.45, "#070b10");
    g.addColorStop(1, "#040507");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const gridA = 0.34 * (1 - seg(p, T.ai[0], T.ai[0] + 0.24) * 0.7);
    this.drawFloorGrid(ctx, p, gridA);
  }

  private drawFloorGrid(ctx: CanvasRenderingContext2D, p: number, strength: number) {
    const { w, h } = this;
    const horizon = h * 0.56 - p * h * 0.05;
    const vp = w * 0.5;
    const travel = p * 1.6;

    ctx.save();
    ctx.strokeStyle = `rgba(120,190,210,${0.1 * strength})`;
    ctx.lineWidth = 1;

    /* radial vertical lines */
    const spread = w * 0.024;
    for (let k = -14; k <= 14; k++) {
      ctx.beginPath();
      ctx.moveTo(vp + k * spread, horizon);
      ctx.lineTo(vp + k * spread * (1 + 4.6), h + 10);
      ctx.stroke();
    }

    /* horizon line */
    ctx.strokeStyle = `rgba(0,229,255,${0.16 * strength})`;
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    ctx.lineTo(w, horizon);
    ctx.stroke();

    /* transverse rows travelling toward the camera */
    const ROWS = 18;
    ctx.strokeStyle = `rgba(150,205,220,${0.14 * strength})`;
    for (let i = 0; i < ROWS; i++) {
      const z = (i + travel * ROWS) / ROWS;
      if (z <= 0.02 || z > 1) continue;
      const y = lerp(horizon, h * 1.04, Math.pow(z, 1.9));
      const a = z * 0.9 * strength;
      ctx.strokeStyle = `rgba(140,200,215,${0.16 * a})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    /* far grid glow dots — muted so top cyan speckles disappear on final */
    ctx.fillStyle = `rgba(120,140,155,${0.18 * strength})`;
    for (let i = 0; i < 40; i++) {
      const z = fmod(travel + i * 0.013, 1);
      const y = lerp(horizon, h, Math.pow(z, 2.2));
      const x = vp + Math.sin(i * 12.9898) * w * 0.4 * z;
      if (y > h) continue;
      ctx.globalAlpha = (1 - z) * 0.5 * strength;
      ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  private drawHorizonGlow(ctx: CanvasRenderingContext2D, p: number) {
    const { w, h } = this;
    const horizon = h * 0.56 - p * h * 0.05;
    const g = ctx.createRadialGradient(w * 0.5, horizon, 0, w * 0.5, horizon, w * 0.7);
    g.addColorStop(0, "rgba(0,229,255,0.08)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, horizon - h * 0.12, w, h * 0.24);
  }

  /* ---------------- factory fixtures ---------------- */

  private drawBeams(ctx: CanvasRenderingContext2D, p: number, ms: number) {
    const { w, h } = this;
    const a = 0.5;
    ctx.strokeStyle = `rgba(140,170,190,${0.13 * a})`;
    ctx.lineWidth = 2;
    const y1 = h * 0.055;
    const y2 = h * 0.11;
    ctx.beginPath();
    ctx.moveTo(0, y1);
    ctx.lineTo(w, y1);
    ctx.moveTo(0, y2);
    ctx.lineTo(w, y2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(140,170,190,${0.09 * a})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, y2);
    ctx.lineTo(w, y2);
    ctx.stroke();

    /* hangers */
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) {
      const x = (w * (i + 0.5)) / 9;
      const drop = h * (0.16 + 0.06 * Math.sin(i * 3.1 + ms * 0.0002) * 0.3);
      ctx.beginPath();
      ctx.moveTo(x, y2);
      ctx.lineTo(x, y2 + drop);
      ctx.stroke();
    }
  }

  private drawConveyor(ctx: CanvasRenderingContext2D, p: number, ms: number) {
    const a =
      seg(p, 0, 0.2, 0.05) * (1 - seg(p, T.ai[0], T.ai[0] + 0.2) * 0.95);
    if (a < 0.01) return;
    const { w, h } = this;
    const y = h * 0.93;
    const cx = w * 0.5;
    const bw = w * 0.42;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = `rgba(160,190,200,${0.5})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - bw / 2, y);
    ctx.lineTo(cx + bw / 2, y);
    ctx.stroke();

    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - bw / 2, y);
    ctx.lineTo(cx + bw / 2, y);
    ctx.strokeStyle = "rgba(0,229,255,0.14)";
    ctx.stroke();

    /* moving product dashes */
    const segs = 14;
    const step = bw / segs;
    const off = fmod(ms * 0.00012, step);
    ctx.strokeStyle = `rgba(20,30,40,0.9)`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < segs; i++) {
      const x = cx - bw / 2 - step + off + i * step;
      ctx.moveTo(x, y);
      ctx.lineTo(x + step * 0.55, y);
    }
    ctx.stroke();

    ctx.fillStyle = `rgba(160,190,200,${0.35 * a})`;
    ctx.fillRect(cx - bw / 2 - 10, y - 2, 8, 4);
    ctx.fillRect(cx + bw / 2 + 2, y - 2, 8, 4);
    ctx.restore();
  }

  private drawMechArms(ctx: CanvasRenderingContext2D, p: number, ms: number) {
    const a = 0.5 * seg(p, 0, 0.12, 0.04) * (1 - seg(p, T.ai[0], T.ai[0] + 0.3));
    if (a < 0.01) return;
    const { h } = this;
    ctx.save();
    ctx.globalAlpha = a * 0.4;
    ctx.lineCap = "round";
    for (const side of [-1, 1] as const) {
      const baseX = side === -1 ? this.w * 0.07 : this.w * 0.93;
      const baseY = h * 0.62;
      const t = ms * 0.0003 + side;
      const a1 = Math.sin(t * 0.7) * 0.5 + side * 0.2;
      const a2 = Math.sin(t * 1.1 + 1.2) * 0.6 - 0.5;
      const L1 = h * 0.2;
      const L2 = h * 0.17;
      const p1x = baseX + Math.sin(a1) * L1;
      const p1y = baseY + Math.cos(a1) * L1;
      const p2x = p1x + Math.sin(a1 + a2) * L2;
      const p2y = p1y + Math.cos(a1 + a2) * L2;

      ctx.strokeStyle = "rgba(150,180,200,0.7)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.stroke();

      ctx.strokeStyle = "rgba(30,45,58,1)";
      ctx.lineWidth = 3;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.stroke();
      ctx.lineCap = "round";

      ctx.fillStyle = "rgba(10,16,22,0.9)";
      ctx.strokeStyle = "rgba(0,229,255,0.5)";
      ctx.lineWidth = 1;
      rr(ctx, p2x - 7, p2y - 7, 14, 14, 3);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- neural network ---------------- */

  private drawNeural(
    ctx: CanvasRenderingContext2D,
    ms: number,
    alpha: number,
    aiT: number
  ) {
    return; // disabled — was drawing 64 large cyan glowing circles (r*5) that filled final robot view
    if (!this.nodes.length) return;
    const pulse = ms * 0.00045;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    /* edges */
    for (const e of this.edges) {
      const na = this.nodes[e.a];
      const nb = this.nodes[e.b];
      const o = 0.05 + 0.2 * clamp01(aiT * 2) * (0.4 + 0.6 * Math.abs(Math.sin(ms * 0.0002 + e.id)));
      ctx.strokeStyle = `rgba(0,229,255,${o * alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(na.x, na.y);
      ctx.lineTo(nb.x, nb.y);
      ctx.stroke();

      /* traveling pulse */
      const t = fmod(e.id * 0.37 + pulse, 1);
      const px = lerp(na.x, nb.x, t);
      const py = lerp(na.y, nb.y, t);
      ctx.fillStyle = `rgba(190,250,255,${0.85 * alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, 1.6, 0, TAU);
      ctx.fill();
    }

    /* nodes */
    for (const n of this.nodes) {
      const tw = 0.5 + 0.5 * Math.sin(ms * 0.001 + n.r * 30 + n.x);
      const r = n.r * (0.85 + 0.3 * tw);
      const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 5);
      glow.addColorStop(0, `rgba(0,229,255,${0.55 * alpha * tw})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 5, 0, TAU);
      ctx.fill();

      ctx.fillStyle = `rgba(235,252,255,${alpha * (0.5 + tw * 0.5)})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 0.7, 0, TAU);
      ctx.fill();
    }

    ctx.restore();
  }

  /* ---------------- robot ---------------- */

  private robotDims() {
    const { w, h } = this;
    const tot = Math.min(h * 0.5, w * 0.72);
    const feetY = h * 0.8;
    const cx = w * 0.5;
    return { s: tot, feetY, cx };
  }

  /** one factory step: delivery + bolt + weld progress for a scroll window */
  private partStep(p: number, from: number, to: number, ms: number): PartBuild {
    const u = clamp01((p - from) / (to - from));
    const d = easeInOutCubic(u);
    const bolt = clamp01((u - 0.38) / 0.34);
    const weld = clamp01((u - 0.58) / 0.3);
    const settle = d < 1 ? Math.sin(ms * 0.028) * 0.0035 * Math.exp(-6 * d) * (1 - d) : 0;
    return { d, bolt, weld, settle };
  }

  private drawRobotScene(
    ctx: CanvasRenderingContext2D,
    p: number,
    ms: number,
    ph: {
      intro: number;
      assemblyT: number;
      aiT: number;
      trainT: number;
      testT: number;
      actT: number;
    }
  ) {
    const { s, feetY, cx } = this.robotDims();

    /* factory assembly: part windows */
    const assembly: Record<PartKey, PartBuild> = {
      legs: this.partStep(p, 0.14, 0.186, ms),
      torso: this.partStep(p, 0.172, 0.206, ms),
      arms: this.partStep(p, 0.2, 0.252, ms),
      head: this.partStep(p, 0.248, 0.304, ms),
      core: this.partStep(p, 0.3, 0.34, ms),
      visor: this.partStep(p, 0.35, 0.4, ms),
    };

    const vis: PoseConfig = {
      legs: assembly.legs.d,
      torso: assembly.torso.d,
      arms: assembly.arms.d,
      head: assembly.head.d,
      core: assembly.core.d,
      visor: assembly.visor.d,
    };

    /* robot scales into frame while being assembled */
    const robotScale = lerp(0.84, 1, mapRange(p, T.assembly[0] - 0.03, T.assembly[0] + 0.09, 0, 1));
    const baseAlpha = seg(p, 0.15, 0.17, 0.015);
    const testDim = 1 - ph.testT * 0.12;
    const zoom = this.zoomHold(p, ph);

    const drawPose = (offset: number, alpha: number) => {
      const rig = this.computeRig(ph, vis, assembly, ms, offset);
      const S = s * robotScale * testDim * zoom;
      ctx.save();
      ctx.globalAlpha = baseAlpha * alpha;
      ctx.translate(cx, feetY);
      ctx.rotate(rig.tilt);
      ctx.scale(S * rig.scale, S * rig.scale);
      ctx.translate(0, rig.drop);
      this.drawBody(ctx, rig, "physical");
      ctx.restore();
    };

    drawPose(0, 1);

    if (ph.assemblyT > 0.01) {
      this.drawAssemblyWorkcell(ctx, p, ms, ph.assemblyT, assembly);
    }

        /* AI core zoom: camera moves in → robot looms larger */
        
  }

  private zoomHold(
    p: number,
    ph: {
      intro: number;
      assemblyT: number;
      aiT: number;
      trainT: number;
      testT: number;
      actT: number;
    }
  ) {
    void p;
    let sc = 0.94 + 0.06 * ph.intro;
    sc *= 1 + ph.aiT * 0.1;
    sc *= 1 + ph.trainT * 0.04;
    return sc;
  }

  /* ---------------- robot rig (articulated servo model) ---------------- */

  /* crisp servo → hold → return envelope */
  private punch(x: number, rise = 0.4, fall = 0.4, hold = 1.2): number {
    const c = clamp01(x);
    return smoothstep(c / rise) - smoothstep((c - (rise + hold)) / fall);
  }

  /* single-leg foot phase: stance → swing → heel strike */
  private footPhase(ph: number): { lift: number; knee: number; load: number } {
    if (ph < 0.5) {
      return { lift: 0, knee: 0, load: 0.06 * Math.max(0, 1 - ph / 0.12) };
    }
    const s = (ph - 0.5) * 2;
    const lift = smoothstep((s - 0) / 0.16) - smoothstep((s - 0.55) / 0.24);
    return { lift, knee: 0.95 * lift, load: 0 };
  }

  private computeRig(
    ph: {
      intro: number;
      assemblyT: number;
      aiT: number;
      trainT: number;
      testT: number;
      actT: number;
    },
    vis: PoseConfig,
    assembly: Record<PartKey, PartBuild>,
    ms: number,
    offset: number
  ): Rig {
    const t = ms * 0.001 + offset;

    const entry = (v: number) => (v <= 0 ? 0 : easeInOutCubic(clamp01(v * 1.25)));
    const e: PoseConfig = {
      legs: entry(vis.legs),
      torso: entry(vis.torso),
      arms: entry(vis.arms),
      head: entry(vis.head),
      core: entry(vis.core),
      visor: entry(vis.visor),
    };

    const breath = Math.sin(t * 1.4);
    const blink = Math.pow(Math.max(0, Math.sin(t * 1.3)), 18);

    /* chapter gates */
    const aiGate = clamp01((ph.aiT - 0.02) / 0.14);
    const march = clamp01((ph.trainT - 0.02) / 0.1);
    const tGate = clamp01((ph.testT - 0.04) / 0.12);
    const act = ph.actT;

    /* --- AI core: looping servo calibration routine (12s) --- */
    const rt = fmod(t, 12);
    const headCal = 0.85 * this.punch(rt - 1.2) - 0.75 * this.punch(rt - 3.2);
    const armRaise = 1.18 * this.punch(rt - 5.4);
    const elbowCal = 0.85 * this.punch(rt - 7);
    const clawCal = 0.9 * this.punch(rt - 8.5);
    const kneeSquat = 0.55 * Math.sin(Math.PI * clamp01((rt - 1.5) / 2.2));
    const hipAbCal = 0.5 * this.punch(rt - 4.4);

    /* --- training: mechanical march (treadmill gait) --- */
    const PHr = fmod(t * 1.05, 1);
    const PHl = fmod(t * 1.05 + 0.5, 1);
    const fr = this.footPhase(PHr);
    const fl = this.footPhase(PHl);
    const bob = 0.0055 * Math.cos(TAU * PHr) * march;
    const hipRoll = 0.012 * Math.sin(TAU * PHr) * march;

    /* --- testing: procedural motions --- */
    const rt2 = fmod(t, 9);
    const sq = rt2 < 2.2 ? 0.5 * Math.sin(Math.PI * clamp01(rt2 / 2.2)) : 0;
    const balance = rt2 >= 2.5 && rt2 < 5 ? 1 : 0;
    const react = rt2 >= 5.4 && rt2 < 6.3 ? Math.sin(Math.PI * clamp01((rt2 - 5.4) / 0.9)) : 0;

    const squatLift = vis.legs > 0.6 ? sq * tGate * 0.5 : 0;
    const squatKnee = vis.legs > 0.6 ? sq * tGate * 0.9 : 0;

    const balThigh = balance * tGate * 0.5;
    const balKnee = balance * tGate * 1.05;
    const balAb = balance * tGate * 1;
    const balArms = balance * tGate;
    const balSway = balance * tGate * 0.03 * Math.sin(t * 2.05);
    const reactLean = react * tGate * 0.075;
    const reactFl = react * tGate * 0.2;

    /* --- activation: servo hero reveal --- */
    const actRev = easeOutQuart(clamp01(act * 1.4));
    const revealScale = lerp(1.3, 1, actRev);
    const revealTilt = lerp(0.12, 0, actRev);
    const revealDrop = lerp(-0.1, 0, actRev);
    const armHero = easeOutQuart(clamp01((act - 0.06) / 0.42));

    const liftL = fl.lift * march + balThigh + squatLift + hipAbCal * aiGate * 0.3;
    const liftR = fr.lift * march + squatLift;
    const kneeL = fl.knee * march + fl.load * march + balKnee + squatKnee + kneeSquat * aiGate * 0.7;
    const kneeR = fr.knee * march + fr.load * march + squatKnee + kneeSquat * aiGate * 0.7;

    return {
      t,
      e,
      assembly,
      breath: breath * 0.006,
      bob: bob + squatLift * 0.05 + balThigh * 0.02 + act * 0.002,
      hipRoll,
      lean: -hipRoll * 1.6 + balSway + reactLean,
      thigh: [liftL, liftR],
      knee: [kneeL, kneeR],
      ankle: [0, 0],
      hipAb: [balAb, 0],
      shoulder: [
        -0.16 + armRaise * aiGate + balArms * 1.2 + reactFl + armHero * 0.98,
        -0.16 + armRaise * aiGate + balArms * 1.2 + reactFl + armHero * 0.98,
      ],
      elbow: [
        0.06 +
          elbowCal * aiGate +
          balArms * 0.12 +
          fl.lift * march * 0.28 +
          reactFl * 0.6 +
          armHero * 0.12,
        0.06 +
          elbowCal * aiGate +
          balArms * 0.12 +
          fr.lift * march * 0.28 +
          reactFl * 0.6 +
          armHero * 0.12,
      ],
      claw: [
        Math.min(1, clawCal * aiGate + balArms * 0.3 + armHero * 0.4),
        Math.min(1, clawCal * aiGate + balArms * 0.3 + armHero * 0.4),
      ],
      headPan: (headCal + 0.15 * Math.sin(t * 0.9)) * aiGate + balSway * 0.5 + react * tGate * 0.6,
      headTilt:
        Math.sin(t * 0.7) * 0.03 * aiGate * 0.6 +
        balSway * 0.5 +
        react * tGate * 0.06 -
        armHero * 0.05,
      visorScan: 0.5 + 0.5 * Math.sin(t * 0.9),
      visorBoost: vis.visor * (0.35 + aiGate * 0.15 + act * 0.5) * (1 - blink * 0.85),
      corePulse: 0.5 + 0.5 * Math.sin(t * 2.6),
      coreBoost: ph.aiT * 0.4 + act * 0.8 + vis.core * 0.25,
      blink,
      drop: revealDrop,
      tilt: revealTilt,
      scale: revealScale,
    };
  }

  /* ---------------- robot renderer ---------------- */

  /**
   * Body renderer. Origin at feet center, +y down. The caller has scaled the
   * context by `s`, so coordinates are in unit space. Parts are delivered,
   * bolted and welded by `rig.assembly`.
   */
  private drawBody(
    ctx: CanvasRenderingContext2D,
    rig: Rig,
    style: "physical" | "cyber"
  ) {
    const {
      e,
      assembly,
      breath,
      bob,
      hipRoll,
      lean,
      thigh,
      hipAb,
      shoulder,
      elbow,
      claw,
      headPan,
      headTilt,
      visorScan,
      corePulse,
      coreBoost,
      visorBoost,
      blink,
      t,
    } = rig;

    const cyber = style === "cyber";
    const steel = (x0: number, y0: number, x1: number, y1: number): CanvasGradient => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, "#5f758c");
      g.addColorStop(0.4, "#2b3c4f");
      g.addColorStop(1, "#0f1822");
      return g;
    };
    const dark = (x0: number, y0: number, x1: number, y1: number): CanvasGradient => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, "#263548");
      g.addColorStop(1, "#0c131d");
      return g;
    };

    /* tapered limb: hip→ankle quad, plates with panel edge */
    const taper = (
      x0: number, y0: number, x1: number, y1: number,
      w0: number, w1: number, tone?: CanvasGradient
    ) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const L = Math.max(1e-5, Math.hypot(dx, dy));
      const nx = (-dy / L) * 0.5;
      const ny = (dx / L) * 0.5;
      if (cyber) {
        ctx.strokeStyle = "rgba(0,229,255,0.5)";
        ctx.lineWidth = Math.max(0.008, w0 * 0.06);
        ctx.beginPath();
        ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
        ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
        ctx.moveTo(x0 - nx * w0, y0 - ny * w0);
        ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
        ctx.stroke();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
      ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
      ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
      ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
      ctx.closePath();
      ctx.fillStyle = tone ?? steel(x0, y0, x1, y1);
      ctx.fill();
      ctx.strokeStyle = "rgba(6,10,15,0.9)";
      ctx.lineWidth = Math.max(0.006, w0 * 0.04);
      ctx.stroke();
      /* plate seam */
      ctx.strokeStyle = "rgba(8,13,19,0.65)";
      ctx.lineWidth = 0.005;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    };

    const box = (
      x: number, y: number, w: number, h: number, r: number, grad: CanvasGradient
    ): void => {
      if (cyber) {
        ctx.strokeStyle = "rgba(0,229,255,0.5)";
        ctx.lineWidth = Math.max(0.008, w * 0.03);
        rr(ctx, x, y, w, h, r);
        ctx.stroke();
        return;
      }
      ctx.fillStyle = grad;
      rr(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.strokeStyle = "rgba(6,10,15,0.9)";
      ctx.lineWidth = Math.max(0.006, w * 0.03);
      ctx.stroke();
    };

    /* mechanical servo housing — matte, no cyan halo (was drawing large cyan circles when cyber) */
    const joint = (x: number, y: number, r: number): void => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "#3a4c5f");
      g.addColorStop(0.6, "#1b2530");
      g.addColorStop(1, "#0a0f16");
      ctx.fillStyle = g;
      ctx.strokeStyle = "rgba(6,10,15,0.9)";
      ctx.lineWidth = Math.max(0.006, r * 0.18);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      if (!cyber) {
        ctx.strokeStyle = "rgba(150,180,200,0.28)";
        ctx.lineWidth = 0.006;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.5, 0, TAU);
        ctx.stroke();
      }
    };

    /* a single torquing bolt (screw head + rotating slot) */
    const screw = (x: number, y: number, r: number, rot: number, lit = false) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      const g = ctx.createRadialGradient(-r * 0.25, -r * 0.3, 0, 0, 0, r);
      g.addColorStop(0, "#8aa0b5");
      g.addColorStop(0.5, "#44586b");
      g.addColorStop(1, "#1a2430");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(4,7,10,0.95)";
      ctx.lineWidth = Math.max(0.004, r * 0.22);
      ctx.stroke();
      ctx.strokeStyle = lit ? "rgba(0,229,255,0.95)" : "rgba(150,180,195,0.9)";
      ctx.lineWidth = Math.max(0.004, r * 0.34);
      ctx.beginPath();
      ctx.moveTo(-r * 0.62, 0);
      ctx.lineTo(r * 0.62, 0);
      ctx.stroke();
      if (lit) {
        ctx.shadowColor = "rgba(0,229,255,0.8)";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    };

    /* ring of bolts used to fasten a joint */
    const boltRing = (
      cx: number, cy: number, radius: number, n: number, b: PartBuild
    ) => {
      if (cyber || b.bolt <= 0.02) return;
      const spin = b.bolt * TAU * 3;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const px = cx + Math.cos(a) * radius;
        const py = cy + Math.sin(a) * radius;
        const slot = b.bolt >= 0.8 ? a : spin + a * 0.5;
        screw(px, py, radius * 0.3, slot, b.bolt > 0.5);
      }
    };

    /* weld flash burst during seam welding */
    const weldFlash = (x: number, y: number, r: number, w: PartBuild) => {
      if (cyber || w.weld <= 0.02 || w.weld >= 1) return;
      const pulse = Math.sin(clamp01(w.weld) * Math.PI);
      const k = pulse * 0.9;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(255,180,90,${k})`;
      ctx.lineWidth = Math.max(0.7, r * 0.045);
      for (let i = 0; i < 8; i++) {
        const a = i * 0.7854 + 0.39;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.02, y + Math.sin(a) * r * 0.02);
        ctx.lineTo(
          x + Math.cos(a) * r * (0.02 + 0.22 * pulse),
          y + Math.sin(a) * r * (0.02 + 0.22 * pulse)
        );
        ctx.stroke();
      }
      ctx.fillStyle = `rgba(255,240,210,${k})`;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.05 * pulse, 0, TAU);
      ctx.fill();
      ctx.restore();
    };

    /* sealed weld seam: stitched plate line */
    const weldSeam = (
      x0: number, y0: number, x1: number, y1: number, w: PartBuild
    ) => {
      if (cyber || w.weld < 1) return;
      ctx.save();
      ctx.strokeStyle = "rgba(110,205,235,0.5)";
      ctx.lineWidth = Math.max(0.6, 0.006);
      ctx.setLineDash([0.014, 0.016]);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    };

    /* ---- floor presence + glow ---- */
    const floorA = 0.42 * (0.35 + 0.65 * e.legs);
    if (!cyber) {
      ctx.fillStyle = `rgba(0,0,0,${floorA})`;
      ctx.beginPath();
      ctx.ellipse(0, 0.014, 0.3, 0.02, 0, 0, TAU);
      ctx.fill();
    }
  // armHero floor glow removed — was drawing large cyan halo at feet on final reveal

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    /* ---------- park offsets per part (gantry delivery) ---------- */
    const PARK: Record<PartKey, [number, number, number]> = {
      legs: [0, 0.34, 0],
      torso: [0, -0.16, 0.34],
      arms: [0.52, -0.05, 0.22],
      head: [0, -0.42, 0],
      core: [0.42, 0, 0.3],
      visor: [0, -0.26, 0],
    };
    const park = (key: PartKey, side = 1) => {
      const b = assembly[key];
      const off = 1 - b.d;
      const P = PARK[key];
      const s = b.settle;
      return {
        x: side * off * P[0] + s * 0.5,
        y: off * P[1] + s * 0.5,
        r: off * P[2],
      };
    };

    /* ============ LEGS ============ */
    if (e.legs > 0.02) {
      const P = park("legs");
      ctx.save();
      ctx.globalAlpha = e.legs;
      ctx.translate(0, P.y);
      const hipY0 = -0.3 + bob * 0.5;
      for (const side of [-1, 1] as const) {
        const i = side === 1 ? 1 : 0;
        const lift = thigh[i];
        const ab = hipAb[i];
        const hipX = side * 0.115;
        const hipY = hipY0;
        const kneeY = hipY + 0.15;
        const kneeX = hipX + side * (0.02 + 0.02 * lift);
        const footY = kneeY + 0.125 * (1 - 0.92 * lift);
        const footX = hipX + side * (0.02 + 0.02 * lift + 0.2 * ab);

        /* thigh plaque + hydraulic piston */
        taper(hipX, hipY, kneeX, kneeY, 0.078, 0.054, steel(hipX, hipY, kneeX, kneeY));
        if (!cyber) {
          const px = hipX + side * 0.024;
          const py0 = lerp(hipY, kneeY, 0.16);
          const py1 = lerp(hipY, kneeY, 0.84);
          ctx.strokeStyle = "rgba(150,175,190,0.35)";
          ctx.lineWidth = 0.014;
          ctx.beginPath();
          ctx.moveTo(px, py0);
          ctx.lineTo(px, py1);
          ctx.stroke();
          ctx.strokeStyle = "rgba(200,225,235,0.3)";
          ctx.lineWidth = 0.006;
          ctx.beginPath();
          ctx.moveTo(px - side * 0.009, py0);
          ctx.lineTo(px - side * 0.009, py0 + 0.015);
          ctx.stroke();
        }
        joint(kneeX, kneeY, 0.03);
        boltRing(kneeX, kneeY, 0.05, 1, assembly.legs);
        weldFlash(kneeX, kneeY, 1, assembly.legs);

        taper(kneeX, kneeY, footX, footY, 0.05, 0.036, steel(kneeX, kneeY, footX, footY));
        joint(footX, footY, 0.024);

        /* foot pod */
        if (cyber) {
          ctx.strokeStyle = "rgba(0,229,255,0.4)";
          ctx.lineWidth = 0.008;
        } else {
          ctx.fillStyle = dark(footX - 0.07, footY, footX + 0.07, footY + 0.04);
        }
        rr(ctx, footX - 0.068, footY - 0.006, 0.136, 0.042, 0.014);
        if (cyber) {
          ctx.stroke();
        } else {
          ctx.fill();
        }
        ctx.strokeStyle = "rgba(6,10,15,0.9)";
        ctx.lineWidth = 0.006;
        ctx.stroke();
        if (!cyber) {
          rr(ctx, footX - 0.028, footY + 0.012, 0.06, 0.018, 0.008);
          ctx.fillStyle = "#16222e";
          ctx.fill();
        }
        boltRing(hipX, hipY, 0.062, 2, assembly.legs);
        weldFlash(hipX, hipY, 1, assembly.legs);
        weldSeam(footX - 0.068, footY - 0.006, footX + 0.068, footY - 0.006, assembly.legs);
      }
      ctx.restore();
    }

    /* ============ UPPER BODY ============ */
    if (e.torso > 0.02) {
      const PT = park("torso");
      ctx.save();
      ctx.globalAlpha = e.torso;

      /* torso pivot: breathe, bob, roll, gantry delivery */
      const hipY = -0.3 + bob * 0.5;
      ctx.translate(0, hipY);
      ctx.rotate(PT.r + hipRoll);
      ctx.translate(0, -hipY);
      ctx.translate(lean * 0.05, bob + breath);

      const waistY = -0.375;

      /* ---- pelvis ---- */
      box(-0.21, hipY - 0.012, 0.42, 0.085, 0.022, dark(-0.21, hipY, 0.21, hipY + 0.08));
      boltRing(0, hipY, 0.24, 4, assembly.torso);
      weldSeam(-0.21, hipY - 0.012, 0.21, hipY - 0.012, assembly.torso);
      if (!cyber) {
        ctx.strokeStyle = "rgba(10,16,24,0.8)";
        ctx.lineWidth = 0.007;
        ctx.beginPath();
        ctx.moveTo(-0.2, hipY + 0.05);
        ctx.lineTo(0.2, hipY + 0.05);
        ctx.stroke();
      }

      /* ---- waist gimbal ---- */
      box(-0.17, hipY - 0.09, 0.34, 0.055, 0.02, steel(-0.17, hipY - 0.09, 0.17, hipY - 0.035));
      box(-0.19, hipY - 0.052, 0.38, 0.05, 0.02, dark(-0.19, hipY - 0.05, 0.19, hipY));
      if (!cyber) {
        ctx.strokeStyle = "rgba(150,180,195,0.3)";
        ctx.lineWidth = 0.007;
        ctx.beginPath();
        ctx.moveTo(-0.14, waistY - 0.02);
        ctx.lineTo(0.14, waistY - 0.02);
        ctx.stroke();
        /* spine piston */
        ctx.strokeStyle = "rgba(170,195,210,0.35)";
        ctx.lineWidth = 0.012;
        ctx.beginPath();
        ctx.moveTo(0, waistY + 0.01);
        ctx.lineTo(0, waistY + 0.055);
        ctx.stroke();
      }

      /* ---- chest armor ---- */
      const chestTop = -0.7;
      const cwTop = 0.15;
      const cwBot = 0.21;
      ctx.beginPath();
      ctx.moveTo(-cwTop, chestTop);
      ctx.lineTo(cwTop, chestTop);
      ctx.lineTo(cwBot, waistY + 0.02);
      ctx.lineTo(-cwBot, waistY + 0.02);
      ctx.closePath();
      if (cyber) {
        ctx.strokeStyle = "rgba(0,229,255,0.55)";
        ctx.lineWidth = 0.01;
        ctx.stroke();
      } else {
        ctx.fillStyle = steel(-cwTop, chestTop, cwTop, waistY - 0.02);
        ctx.fill();
        ctx.strokeStyle = "rgba(6,10,15,0.9)";
        ctx.lineWidth = 0.01;
        ctx.stroke();
        /* panel seams + vents */
        ctx.strokeStyle = "rgba(10,16,24,0.75)";
        ctx.lineWidth = 0.008;
        ctx.beginPath();
        ctx.moveTo(0, chestTop + 0.02);
        ctx.lineTo(0, waistY + 0.02);
        ctx.stroke();
        ctx.lineWidth = 0.006;
        for (const side of [-1, 1] as const) {
          for (let v = 0; v < 2; v++) {
            ctx.beginPath();
            ctx.moveTo(side * 0.14 - 0.012 * v, chestTop + 0.05);
            ctx.lineTo(side * 0.14 - 0.012 * v, chestTop + 0.09);
            ctx.stroke();
          }
        }
      }
      /* hermetically welded chest seams */
      weldSeam(-cwBot, waistY + 0.02, -cwTop, chestTop, assembly.torso);
      weldSeam(cwBot, waistY + 0.02, cwTop, chestTop, assembly.torso);
      weldSeam(-cwTop, chestTop, cwTop, chestTop, assembly.torso);
      boltRing(0, lerp(chestTop, waistY, 0.14), 0.2, 4, assembly.torso);
      weldFlash(0, chestTop + 0.02, 1, assembly.torso);

      /* ---- chest reactor core ---- */
      if (e.core > 0.02) {
        const PC = park("core");
        ctx.save();
        ctx.translate(PC.x, PC.y);
        const cw = 0.15 * (0.55 + 0.45 * e.core);
        const ch = 0.21 * e.core;
        this.drawCore(ctx, 0, -0.545, cw, ch, coreBoost * (0.3 + 0.7 * corePulse), clamp01(e.core));
        boltRing(0, -0.545, 0.105, 3, assembly.core);
        weldFlash(0, -0.545, 1, assembly.core);
        weldSeam(-0.105, -0.545, 0.105, -0.545, assembly.core);
        weldSeam(0, -0.655, 0, -0.455, assembly.core);
        ctx.restore();
      }

      /* ---- shoulder armor ---- */
      for (const side of [-1, 1] as const) {
        const shX = side * 0.185;
        const shY = -0.66;
        box(
          side * 0.13 - 0.065,
          chestTop - 0.035,
          0.13,
          0.11,
          0.05,
          steel(side * 0.13 - 0.065, chestTop, side * 0.13 + 0.065, chestTop + 0.11)
        );
        joint(shX, shY, 0.038);
        boltRing(shX, shY, 0.06, 2, assembly.arms);
        weldFlash(shX, shY, 1, assembly.arms);
        weldSeam(shX - 0.06, shY + 0.05, shX + 0.06, shY + 0.05, assembly.arms);
      }

      /* ============ ARMS ============ */
      if (e.arms > 0.02) {
        const UL = 0.155;
        const FL = 0.135;
        const tremor = 0.002 * (1 + 0.6 * Math.sin(t * 37));
        for (const side of [-1, 1] as const) {
          const i = side === 1 ? 1 : 0;
          const PA = park("arms", side);
          const shX = side * 0.185;
          const shY = -0.66;
          const ang = shoulder[i] + tremor;

          ctx.save();
          ctx.globalAlpha = Math.min(1, e.arms);
          ctx.translate(shX + PA.x, shY + PA.y);
          ctx.rotate(-side * PA.r);

          /* upper arm */
          const ex = Math.sin(ang) * UL;
          const ey = Math.cos(ang) * UL;
          taper(0, 0, ex, ey, 0.06, 0.044, steel(0, 0, ex, ey));
          joint(ex, ey, 0.027);

          /* forearm */
          const fAng = ang + (elbow[i] - 0.06) * 0.7;
          const hx = ex + Math.sin(fAng) * FL;
          const hy = ey + Math.cos(fAng) * FL;
          taper(ex, ey, hx, hy, 0.044, 0.03, steel(ex, ey, hx, hy));
          boltRing(ex, ey, 0.04, 1, assembly.arms);
          joint(hx, hy, 0.02);

          /* hydraulic cylinder along the forearm */
          if (!cyber) {
            ctx.strokeStyle = "rgba(150,175,190,0.3)";
            ctx.lineWidth = 0.012;
            ctx.beginPath();
            ctx.moveTo(ex, ey + 0.015);
            ctx.lineTo(hx, hy + 0.004);
            ctx.stroke();
          }

          /* claw / gripper hand */
          const open = claw[i];
          const spread = 0.3 + open * 0.55;
          for (const d of [-1, 1] as const) {
            const jA = fAng + d * spread;
            const t1x = hx + Math.sin(jA) * 0.045;
            const t1y = hy + Math.cos(jA) * 0.045;
            taper(hx, hy, t1x, t1y, 0.016, 0.008, dark(hx, hy, t1x, t1y));
            const t2x = t1x + Math.sin(jA + d * 0.5) * 0.018;
            const t2y = t1y + Math.cos(jA + d * 0.5) * 0.018;
            taper(t1x, t1y, t2x, t2y, 0.008, 0.004, dark(t1x, t1y, t2x, t2y));
          }
          ctx.restore();
        }
      }

      /* ============ HEAD ============ */
      if (e.head > 0.02) {
        const PH = park("head");
        const neckTop = -0.735;
        ctx.save();
        ctx.globalAlpha = Math.min(1, e.head);

        /* neck column */
        box(-0.035, neckTop + 0.01, 0.07, 0.06, 0.012, dark(-0.035, neckTop, 0.035, neckTop + 0.07));
        if (!cyber) {
          ctx.strokeStyle = "rgba(10,16,24,0.8)";
          ctx.lineWidth = 0.006;
          ctx.beginPath();
          ctx.moveTo(-0.028, neckTop + 0.03);
          ctx.lineTo(0.028, neckTop + 0.03);
          ctx.moveTo(-0.028, neckTop + 0.055);
          ctx.lineTo(0.028, neckTop + 0.055);
          ctx.stroke();
        }

        ctx.translate(0, neckTop);
        ctx.translate(PH.x * 0.5, PH.y);
        ctx.translate(headPan * 0.015, 0);
        ctx.rotate(headTilt);

        /* head shell */
        box(-0.125, -0.205, 0.25, 0.205, 0.06, steel(-0.125, -0.205, 0.125, 0));
        /* ear mounts */
        box(-0.152, -0.168, 0.05, 0.09, 0.018, dark(-0.152, -0.168, -0.102, -0.078));
        box(0.102, -0.168, 0.05, 0.09, 0.018, dark(0.102, -0.168, 0.152, -0.078));
        /* crown vents */
        if (!cyber) {
          ctx.strokeStyle = "rgba(10,16,24,0.7)";
          ctx.lineWidth = 0.006;
          for (let v = 0; v < 3; v++) {
            ctx.beginPath();
            ctx.moveTo(-0.06 + v * 0.06, -0.19);
            ctx.lineTo(-0.06 + v * 0.06, -0.16);
            ctx.stroke();
          }
          /* panel seam */
          ctx.beginPath();
          ctx.moveTo(0, -0.19);
          ctx.lineTo(0, -0.045);
          ctx.stroke();
        }

        /* visor — sensor strip */
        const PV = park("visor");
        const vY = -0.06 + PV.y;
        const vH = 0.047;
        const vW = 0.17;
        ctx.save();
        ctx.translate(PV.x * 0.5, 0);
        const visorOn = visorBoost * (1 - blink * 0.85);
        if (visorOn > 0.03) {
          // reworked: matte dark visor, no cyan gradient / scan streak at final
          const vgDark = dark(-vW / 2, vY, vW / 2, vY + vH);
          box(-vW / 2, vY, vW, vH, vH / 2, vgDark);
          // scan highlight removed
          ctx.fillStyle = "rgba(120,140,155,0.18)";
          rr(ctx, -vW / 2 + 0.02, vY + 0.01, vW - 0.04, vH - 0.02, 0.01);
          ctx.fill();
        } else if (e.visor > 0.02) {
          box(-vW / 2, vY, vW, vH, vH / 2, dark(-vW / 2, vY, vW / 2, vY + vH));
        }
        boltRing(-vW / 2, vY + vH / 2, 0.03, 1, assembly.visor);
        boltRing(vW / 2, vY + vH / 2, 0.03, 1, assembly.visor);
        weldSeam(-vW / 2, vY, vW / 2, vY, assembly.visor);
        weldFlash(0, vY, 1, assembly.visor);
        ctx.restore();

        /* jaw plate */
        if (!cyber) {
          ctx.strokeStyle = "rgba(10,16,24,0.75)";
          ctx.lineWidth = 0.006;
          ctx.beginPath();
          ctx.moveTo(-0.075, -0.012);
          ctx.lineTo(0.075, -0.012);
          ctx.moveTo(-0.05, -0.024);
          ctx.lineTo(0.05, -0.024);
          ctx.stroke();
        }
        ctx.restore();

        /* antenna */
        const antX = 0;
        const antY = neckTop + PH.y - 0.205;
        ctx.strokeStyle = cyber ? "rgba(0,229,255,0.5)" : "rgba(150,180,195,0.4)";
        ctx.lineWidth = 0.006;
        ctx.beginPath();
        ctx.moveTo(antX, antY);
        ctx.lineTo(antX, antY - 0.085);
        ctx.stroke();
  // antenna tip glow removed
      }

      ctx.restore();
    }

    ctx.restore();
  }

  private drawCore(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    glow: number,
    vis: number
  ) {
    if (vis <= 0.02) return;
    ctx.save();
    ctx.fillStyle = this.grad(ctx, x - w / 2, y, x + w / 2, y + h);
    rr(ctx, x - w / 2, y, w, h, w * 0.28);
    ctx.fill();
    ctx.strokeStyle = "rgba(5,8,11,0.9)";
    ctx.lineWidth = Math.max(1, w * 0.09);
    ctx.stroke();

    // core cyan glow rects removed for clean final look
    ctx.restore();
  }

  private grad(
    ctx: CanvasRenderingContext2D,
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "#344557");
    g.addColorStop(0.45, "#1e2936");
    g.addColorStop(1, "#10161f");
    return g;
  }

  private drawAssemblyWorkcell(
    ctx: CanvasRenderingContext2D,
    p: number,
    ms: number,
    t: number,
    assembly: Record<PartKey, PartBuild>
  ) {
    const { w, h } = this;
    const { s, feetY, cx } = this.robotDims();
    const u = clamp01((p - T.assembly[0]) / (T.assembly[1] - T.assembly[0]));
    const stage = Math.min(4, Math.floor(u * 5));
    const targets = [
      [cx - s * 0.12, feetY - s * 0.25],
      [cx, feetY - s * 0.48],
      [cx + s * 0.18, feetY - s * 0.48],
      [cx, feetY - s * 0.7],
      [cx, feetY - s * 0.78],
    ];
    const target = targets[stage];
    const gantryX = w * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(ms * 0.00035 + stage)));
    const gantryY = h * 0.12;
    const elbowX = lerp(gantryX, target[0], 0.5);
    const elbowY = lerp(gantryY + h * 0.08, target[1], 0.42);
    const alpha = clamp01(t * 1.4) * (1 - clamp01((u - 0.9) / 0.1));

    // hide workcell entirely in testing/activation so no cyan joints linger on final reveal
    if (p > T.testing[0] - 0.02) return;
    ctx.save();
    ctx.globalAlpha = alpha * 0.92;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    /* overhead rail and moving gantry carriage */
    ctx.strokeStyle = "rgba(160,185,198,0.3)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.12, gantryY);
    ctx.lineTo(w * 0.88, gantryY);
    ctx.stroke();
    ctx.fillStyle = "rgba(22,32,42,0.96)";
    rr(ctx, gantryX - 24, gantryY - 9, 48, 18, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(100,115,130,0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();

    /* articulated manufacturing arm */
    ctx.strokeStyle = "rgba(9,15,22,0.98)";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(gantryX, gantryY + 8);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(target[0], target[1]);
    ctx.stroke();
    ctx.strokeStyle = "rgba(111,135,151,0.8)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(gantryX, gantryY + 8);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(target[0], target[1]);
    ctx.stroke();
    for (const joint of [[gantryX, gantryY + 8], [elbowX, elbowY], target] as const) {
      ctx.fillStyle = "#182532";
      ctx.beginPath();
      ctx.arc(joint[0], joint[1], 9, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(100,115,130,0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    /* tool head changes with the current manufacturing operation */
    const toolY = target[1] + 18;
    ctx.strokeStyle = "rgba(10,16,22,0.98)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    if (stage === 3 || stage === 4) {
      ctx.moveTo(target[0] - 10, toolY);
      ctx.lineTo(target[0] - 3, toolY + 12);
      ctx.moveTo(target[0] + 10, toolY);
      ctx.lineTo(target[0] + 3, toolY + 12);
    } else {
      ctx.moveTo(target[0], toolY - 2);
      ctx.lineTo(target[0], toolY + 15);
    }
    ctx.stroke();

    /* active weld arc and sparks, kept tight to the tool tip */
    const weldActive = stage === 2 || stage === 3;
    if (weldActive) {
      const pulse = 0.45 + 0.55 * Math.abs(Math.sin(ms * 0.012));
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255,220,150,${0.7 * pulse})`;
      ctx.beginPath();
      ctx.arc(target[0], toolY + 13, 4 + pulse * 3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,150,54,${0.75 * pulse})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = ms * 0.004 + i * 1.047;
        const len = 8 + (i % 3) * 6;
        ctx.beginPath();
        ctx.moveTo(target[0], toolY + 13);
        ctx.lineTo(target[0] + Math.cos(a) * len, toolY + 13 + Math.sin(a) * len);
        ctx.stroke();
      }
    }

    /* torque heads sit on the active module, not in the surrounding atmosphere */
    ctx.globalCompositeOperation = "source-over";
    const bolt = stage === 0 ? assembly.legs : stage === 1 ? assembly.torso : stage === 2 ? assembly.arms : assembly.head;
    const boltCount = Math.round(bolt.bolt * 4);
    for (let i = 0; i < boltCount; i++) {
      const a = i * TAU / 4 + ms * 0.002 * (1 - bolt.bolt);
      const bx = target[0] + Math.cos(a) * 15;
      const by = target[1] + Math.sin(a) * 10;
      ctx.fillStyle = "#6d8598";
      ctx.beginPath();
      ctx.arc(bx, by, 3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = bolt.bolt > 0.5 ? "rgba(0,229,255,0.9)" : "rgba(205,225,235,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx - 2, by);
      ctx.lineTo(bx + 2, by);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- testing chamber ---------------- */

  private drawChamber(ctx: CanvasRenderingContext2D, p: number, ms: number, t: number) {
    const { w, h } = this;
    const { feetY } = this.robotDims();
    const L = w * 0.2;
    const R = w * 0.8;
    const TY = h * 0.16;
    const BY = h * 0.9;
    const sw = R - L;
    const sh = BY - TY;

    ctx.save();
    const inT = t * seg(p, T.testing[0], T.testing[0] + 0.05, 0);

    /* chamber glow */
    const cg = ctx.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, sw);
    cg.addColorStop(0, `rgba(48,16,10,${0.28 * inT})`);
    cg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, w, h);

    /* floor line + hazard tape */
    ctx.strokeStyle = `rgba(160,120,90,${0.5 * inT})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(L, feetY + h * 0.02);
    ctx.lineTo(R, feetY + h * 0.02);
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.35 * inT;
    ctx.fillStyle = "rgba(255,82,51,0.6)";
    ctx.fillRect(L, feetY + h * 0.02, sw, 18);
    ctx.restore();

    /* corner brackets */
    const br = 26;
    ctx.strokeStyle = `rgba(255,160,90,${0.8 * inT})`;
    ctx.lineWidth = 2;
    const bracket = (x: number, y: number, dirX: number, dirY: number) => {
      ctx.beginPath();
      ctx.moveTo(x + dirX * br, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dirY * br);
      ctx.stroke();
    };
    bracket(L, TY, 1, 1);
    bracket(R, TY, -1, 1);
    bracket(L, BY, 1, -1);
    bracket(R, BY, -1, -1);

    /* wall grid */
    ctx.strokeStyle = `rgba(255,150,80,${0.06 * inT})`;
    ctx.lineWidth = 1;
    for (let i = 1; i < 9; i++) {
      ctx.beginPath();
      ctx.moveTo(L, TY + (sh * i) / 9);
      ctx.lineTo(R, TY + (sh * i) / 9);
      ctx.stroke();
    }

    /* sweeping scan beam */
    const scan = seg(p, T.testing[0] + 0.12, T.testing[1], 0);
    const sy = lerp(h * 0.3, h * 0.86, scan);
    const beam = ctx.createLinearGradient(0, sy - 46, 0, sy + 10);
    beam.addColorStop(0, "rgba(255,120,40,0)");
    beam.addColorStop(0.8, `rgba(255,110,40,${0.16 * inT})`);
    beam.addColorStop(1, `rgba(255,150,80,${0.7 * inT})`);
    ctx.fillStyle = beam;
    ctx.fillRect(L, sy - 46, sw, 56);

    ctx.strokeStyle = `rgba(255,170,110,${0.8 * inT})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L, sy);
    ctx.lineTo(R, sy);
    ctx.stroke();

    /* test lanes visual */
    ctx.strokeStyle = `rgba(255,120,60,${0.22 * inT})`;
    for (let lane = 0; lane < 3; lane++) {
      const ly = h * (0.34 + lane * 0.12);
      const x = fmod(ms * 0.0005 * (1 + lane * 0.4), sw);
      ctx.beginPath();
      ctx.moveTo(L + x, ly);
      ctx.lineTo(L + x + sw * 0.12, ly);
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ---------------- activation ---------------- */

  private drawActivation(ctx: CanvasRenderingContext2D, ms: number, t: number) {
    const { w, h } = this;
    const { feetY } = this.robotDims();

    ctx.save();
    ctx.globalAlpha = t;

    /* quiet completion bay: overhead fixtures and a grounded inspection line */
    ctx.strokeStyle = "rgba(175,195,204,0.24)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.16, h * 0.12);
    ctx.lineTo(w * 0.84, h * 0.12);
    ctx.moveTo(w * 0.24, h * 0.12);
    ctx.lineTo(w * 0.24, h * 0.3);
    ctx.moveTo(w * 0.76, h * 0.12);
    ctx.lineTo(w * 0.76, h * 0.3);
    ctx.stroke();

    ctx.fillStyle = "rgba(215,235,238,0.55)";
    for (const x of [w * 0.3, w * 0.5, w * 0.7]) {
      ctx.fillRect(x - 28, h * 0.13, 56, 4);
    }

    ctx.strokeStyle = `rgba(125,165,174,${0.4 * t})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, feetY + h * 0.035);
    ctx.lineTo(w * 0.8, feetY + h * 0.035);
    ctx.stroke();

    /* small status beacon — kept tiny and dim (was the green bottom dot) */
    const beacon = 0.5 + 0.5 * Math.sin(ms * 0.004);
    ctx.fillStyle = `rgba(77,255,176,${0.25 + beacon * 0.15})`;
    ctx.beginPath();
    ctx.arc(w * 0.5, feetY + h * 0.035, 2, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  /* ---------------- atmosphere ---------------- */

  private drawDust(ctx: CanvasRenderingContext2D, ms: number, p: number) {
    const a = 0.22 + Math.sin(ms * 0.0004) * 0.04;
    ctx.save();
    ctx.fillStyle = "rgba(190,215,225,0.8)";
    for (const d of this.dust) {
      const x = fmod(d.x + d.vx * d.z * 0.6 + d.z * p * p * 2, this.w);
      const y = fmod(d.y + d.vy * d.z * 4 + ms * 0.00002 * d.z * 40, this.h);
      ctx.globalAlpha = d.z * a * 0.7;
      ctx.fillRect(x, y, d.z * 1.7, d.z * 1.7);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawSpeedLines(ctx: CanvasRenderingContext2D, speed: number) {
    const s = clamp01(Math.abs(speed) / 14);
    if (s < 0.06) return;
    ctx.save();
    ctx.strokeStyle = "rgba(200,240,255,0.06)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 18; i++) {
      const y = (this.h * (i + 0.5)) / 18;
      const drift = fmod((i * 37 + this.w) * 0.01, 1) * this.w;
      const len = 20 + s * 90;
      const x = drift + (i % 3 - 1) * this.w * 0.18;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * Math.sign(speed), y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* helper: hero reveal intensity for floor glow */
function armHeroLit(rig: Rig): number {
  const a = Math.max(rig.shoulder[0], rig.shoulder[1]);
  return clamp01((a - 0.7) / 0.5);
}