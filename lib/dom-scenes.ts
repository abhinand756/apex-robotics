import { clamp01, lerp, smoothstep } from "@/lib/animate";
import { CHAPTERS, activeChapter, ASSEMBLY_PARTS, T } from "@/lib/timeline";

type Els = Map<string, HTMLElement>;

function get(els: Els, id: string): HTMLElement | null {
  return els.get(id) ?? null;
}

function setOpacity(el: HTMLElement, o: number) {
  el.style.opacity = clamp01(o).toFixed(3);
}

function setY(el: HTMLElement, y: number) {
  el.style.transform = `translateY(${y.toFixed(1)}px)`;
}

function setScaleX(el: HTMLElement, v: number) {
  el.style.transform = `scaleX(${clamp01(v).toFixed(3)})`;
  el.style.transformOrigin = "left center";
}

function setText(el: HTMLElement, txt: string) {
  if (el.textContent !== txt) el.textContent = txt;
}

/** soft opacity window around a chapter's [a,b] range without bleeding into other chapters */
function chapterFade(p: number, a: number, b: number): number {
  if (p < a - 0.02 || p > b + 0.02) return 0;
  const fade = 0.035;
  const inO = smoothstep((p - (a - 0.01)) / fade);
  const outO = 1 - smoothstep((p - (b - fade)) / fade);
  return Math.max(0, Math.min(1, inO * outO));
}

const ASSEMBLY_STATUS: Record<string, string> = {
  frame: "FORMED",
  actuators: "TORQUED",
  sensor: "WELDED",
  core: "FITTED",
  compute: "PASSED",
};

const AI_BARS = [
  { id: "bar-vision", v: "bar-vision-v", target: 98.7, speed: 1.05 },
  { id: "bar-spatial", v: "bar-spatial-v", target: 96.2, speed: 0.96 },
  { id: "bar-motion", v: "bar-motion-v", target: 99.1, speed: 0.9 },
  { id: "bar-detect", v: "bar-detect-v", target: 97.8, speed: 0.98 },
] as const;

const TEST_ROWS = [
  "MOBILITY",
  "BALANCE",
  "VISION",
  "REACTION",
  "LOAD",
  "PRECISION",
  "OBSTACLE AVOID",
  "AI RESPONSE",
] as const;

/* cheap text caches to avoid layout thrash */
const cache: Record<string, string> = {};

export function updateDomScenes(p: number, ms: number, els: Els) {
  updateIntro(p, els);
  updateAssembly(p, els);
  updateAI(p, els);
  updateTraining(p, els);
  updateTesting(p, els);
  updateActivation(p, els);
  updateChrome(p, ms, els);
}

/* ---------------- intro ---------------- */

function updateIntro(p: number, els: Els) {
  const root = get(els, "s-intro");
  if (!root) return;
  const o = 1 - smoothstep((p - 0.02) / 0.13);
  setOpacity(root, o * (p < T.assembly[0] ? 1 : 0));
  setY(root, -14 * (1 - o));

  const sub = get(els, "s-intro-sub");
  if (sub) {
    const so = 1 - smoothstep((p - 0.03) / 0.1);
    setOpacity(sub, so);
  }

  const hint = get(els, "s-scroll-hint");
  if (hint) {
    const h = 1 - smoothstep((p - 0.005) / 0.05);
    setOpacity(hint, h);
  }
}

/* ---------------- assembly ---------------- */

function updateAssembly(p: number, els: Els) {
  const root = get(els, "s-assembly");
  if (!root) return;
  setOpacity(root, chapterFade(p, T.assembly[0], T.assembly[1]));

  const title = get(els, "s-assembly-title");
  if (title) {
    setOpacity(title, chapterFade(p, T.assembly[0], T.assembly[1]));
  }

  for (const part of ASSEMBLY_PARTS) {
    const chip = get(els, `chip-${part.id}`);
    if (!chip) continue;
    const local = clamp01((p - part.from) / (part.to - part.from));
    const enter = smoothstep((p - (part.from - 0.015)) / 0.04);
    const co = enter * (1 - smoothstep((p - part.to) / 0.1));
    setOpacity(chip, Math.max(co, local > 0.9 ? co : local * 0.12));
    setY(chip, 18 * (1 - enter));

    const st = get(els, `chip-${part.id}-st`);
    if (st) {
      const done = p >= part.to;
      const prevDone =
        part.id === "frame" || p >= part.from - 0.02;
      if (done && st.dataset.state !== "done") {
        st.dataset.state = "done";
        st.textContent = ASSEMBLY_STATUS[part.id];
        st.style.color = "#4dffb0";
      } else if (!prevDone && st.dataset.state === "done") {
        st.textContent = "SEQUENCED";
        st.style.color = "";
      }
    }
  }
}

/* ---------------- AI core ---------------- */

function updateAI(p: number, els: Els) {
  const root = get(els, "s-ai");
  if (!root) return;
  setOpacity(root, chapterFade(p, T.ai[0], T.ai[1]));

  const a = clamp01((p - 0.42) / 0.18);

  const status = get(els, "ai-status");
  if (status) {
    const on = a > 0.16;
    const o = smoothstep((a - 0.14) / 0.06);
    setOpacity(status, o);
    if (on && status.dataset.on !== "1") {
      status.dataset.on = "1";
      status.textContent = "●  AI CORE ONLINE";
    }
  }

  for (const bar of AI_BARS) {
    const fill = get(els, bar.id);
    if (!fill) continue;
    const v = clamp01(a * bar.speed) * bar.target / 100;
    setScaleX(fill, Math.max(0.02, v));
    const val = (v * 100).toFixed(1) + "%";
    const valEl = get(els, bar.v);
    if (valEl && cache[bar.v] !== val) {
      cache[bar.v] = val;
      valEl.textContent = val;
    }
  }

  const nn = get(els, "nn-fill");
  if (nn) setScaleX(nn, clamp01(a * 1.12));
  const nnv = get(els, "nn-pct");
  if (nnv) {
    const txt = `${Math.round(clamp01(a * 1.12) * 100)}%`;
    if (cache.nn !== txt) {
      cache.nn = txt;
      nnv.textContent = txt;
    }
  }
}

/* ---------------- training ---------------- */

function updateTraining(p: number, els: Els) {
  const root = get(els, "s-training");
  if (!root) return;
  setOpacity(root, chapterFade(p, T.training[0], T.training[1]));

  const link = get(els, "twin-link");
  if (link) {
    const linkIn = smoothstep((p - 0.65) / 0.05);
    const linkOut = 1 - smoothstep((p - 0.75) / 0.04);
    setOpacity(link, linkIn * linkOut * 0.9);
    link.style.transform = `translateX(-50%) scaleX(${(0.55 + linkIn * 0.45).toFixed(3)})`;
  }

  const labels: [string, number][] = [
    ["twin-l", 0.635],
    ["twin-r", 0.64],
    ["twin-d", 0.645],
  ];
  for (const [id, at] of labels) {
    const el = get(els, id);
    if (el) {
      setOpacity(el, smoothstep((p - at) / 0.025));
    }
  }

  const tasks = [
    "OBJ_RECOGNITION.EXE",
    "PATH_PLAN.EXE",
    "PICK_PLACE.EXE",
    "HUMAN_DETECT.EXE",
    "BALANCE_FIX.EXE",
  ];
  tasks.forEach((name, i) => {
    const row = get(els, `task-${i + 1}`);
    if (!row) return;
    const t = smoothstep((p - (0.648 + i * 0.02)) / 0.03);
    setOpacity(row, t * (1 - smoothstep((p - 0.76) / 0.05)));
    setY(row, 10 * (1 - t));
    /* running indicator */
    const run = row.querySelector("[data-role='run']");
    if (run) {
      const state = p > 0.66 + i * 0.01 ? "SYNCED" : "RUN";
      if (cache[`task-${i}`] !== state) {
        cache[`task-${i}`] = state;
        run.textContent = state;
      }
    }
  });
}

/* ---------------- testing ---------------- */

function updateTesting(p: number, els: Els) {
  const root = get(els, "s-testing");
  if (!root) return;
  setOpacity(root, chapterFade(p, T.testing[0], T.testing[1]));

  const big = get(els, "test-big");
  if (big) {
    const o = smoothstep((p - 0.78) / 0.05);
    setOpacity(big, o);
    const s = 0.9 + 0.1 * o;
    big.style.transform = `scale(${s.toFixed(3)})`;
  }

  TEST_ROWS.forEach((label, i) => {
    const row = get(els, `t-${i + 1}`);
    if (!row) return;
    const rowO = smoothstep((p - (0.795 + i * 0.012)) / 0.02);
    setOpacity(row, rowO);
    setY(row, 9 * (1 - rowO));

    const st = get(els, `t-${i + 1}-st`);
    if (st) {
      const pass = p > 0.8 + i * 0.012;
      const txt = pass ? "PASS" : "----";
      if (cache[`t-${i}`] !== txt) {
        cache[`t-${i}`] = txt;
        st.textContent = txt;
        st.style.color = pass ? "#4dffb0" : "rgba(234,246,255,0.35)";
      }
    }
  });

  const diag = get(els, "diag-bar");
  if (diag) {
    const v = clamp01((p - 0.8) / 0.08);
    setScaleX(diag, v);
  }

  for (let i = 1; i <= 4; i++) {
    const line = get(els, `diag-${i}`);
    if (!line) {
      continue;
    }
    const t = smoothstep((p - (0.802 + i * 0.018)) / 0.02);
    setOpacity(line, t);
  }

  const pct = get(els, "pct-100");
  if (pct) {
    const o = smoothstep((p - 0.872) / 0.02);
    setOpacity(pct, o);
  }
}

/* ---------------- activation ---------------- */

function updateActivation(p: number, els: Els) {
  const root = get(els, "s-activation");
  if (!root) return;

  const a = smoothstep((p - 0.9) / 0.07);
  setOpacity(root, a);

  const title = get(els, "act-title");
  if (title) {
    const o = smoothstep((p - 0.905) / 0.06);
    setOpacity(title, o);
    const tx = 8 * (1 - o);
    title.style.transform = `translateY(${tx.toFixed(1)}px)`;
  }

  const sub = get(els, "act-sub");
  if (sub) setOpacity(sub, smoothstep((p - 0.946) / 0.03));

  const buttons = get(els, "act-buttons");
  if (buttons) setOpacity(buttons, smoothstep((p - 0.958) / 0.03));

  const lights = get(els, "act-lights");
  if (lights) setOpacity(lights, smoothstep((p - 0.915) / 0.08));
}

/* ---------------- chrome ---------------- */

let lastChapter = -1;
function updateChrome(p: number, ms: number, els: Els) {
  const chapter = activeChapter(p);
  const idx = CHAPTERS.findIndex((c) => c.key === chapter.key);

  if (idx !== lastChapter) {
    lastChapter = idx;
    const num = get(els, "hud-num");
    const name = get(els, "hud-name");
    if (num) setText(num, chapter.num);
    if (name) setText(name, chapter.name);

    CHAPTERS.forEach((c, i) => {
      const dot = get(els, `rail-dot-${String(i + 1).padStart(2, "0")}`);
      if (!dot) return;
      const on = i === idx || (i < idx && idx - i <= 2);
      dot.dataset.active = on ? "1" : "0";
      dot.style.opacity = on ? "1" : "0.3";
    });
  }

  const bar = get(els, "pbar-fill");
  if (bar) setScaleX(bar, p);

  const rail = get(els, "rail-fill");
  if (rail) {
    rail.style.height = `${(p * 100).toFixed(2)}%`;
  }

  /* coordinates readout (throttled by change) */
  const coords = get(els, "coords");
  if (coords) {
    const x = (Math.sin(ms * 0.00012) * 4 + 40).toFixed(2);
    const y = (Math.cos(ms * 0.00009) * 4 + 40).toFixed(2);
    const txt = `${(lerp(0.1, 1, smoothstep(p)).toFixed(2))} · ${x} / ${y}`;
    if (cache.coords !== txt && Math.floor(ms / 60) % 2 === 0) {
      cache.coords = txt;
      coords.textContent = txt;
    }
  }
}