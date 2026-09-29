"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scene } from "./scene";
import { SceneCanvas } from "./SceneCanvas";
import { Sections } from "./Sections";
import { BootLoader } from "./BootLoader";
import { Scene3D } from "./Robot3D";
import { updateDomScenes } from "@/lib/dom-scenes";
import { CHAPTERS } from "@/lib/timeline";
import { InspectionToolbar } from "./robot/InspectionToolbar";
import { HomepageHero } from "./homepage/HomepageHero";

// Total scroll length: Layer 1 (Hero Showcase: ~26%) + Layer 2 (3D Manufacturing Journey: ~74%)
const PAGE_HEIGHT_VH = 980;
const HERO_END_P = 0.26;

/* Factory-entry curtain. The gradient begins rising just before the hero hands
   off, holds at full opacity across the crossfade, then dissolves once the
   manufacturing bay is established. */
const CURTAIN_IN = 0.244;
const CURTAIN_UP = 0.272;
const CURTAIN_PEAK = 0.282;
const CURTAIN_OUT = 0.332;

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const STREAKS = [
  { left: "14%", dur: "2.9s", delay: "0s", w: 2, h: "26vh" },
  { left: "33%", dur: "3.7s", delay: "0.9s", w: 1, h: "34vh" },
  { left: "52%", dur: "2.4s", delay: "0.35s", w: 3, h: "20vh" },
  { left: "69%", dur: "3.3s", delay: "1.5s", w: 2, h: "30vh" },
  { left: "86%", dur: "4.1s", delay: "0.6s", w: 1, h: "24vh" },
] as const;

const CURTAIN_WORDS = ["ENTERING", "INTO", "FACTORY"] as const;

export function Experience() {
  const elsRef = useRef(new Map<string, HTMLElement>());
  const sceneRef = useRef<Scene | null>(null);
  const speedRef = useRef(0);
  const progressRef = useRef(0);
  // Live hero sub-progress as a ref so the R3F scene never re-renders on scroll.
  const pHeroRef = useRef(0);
  // Quantised scroll progress: drives DOM/animation layers only, so React
  // re-renders ~240 times per full page instead of once per animation frame.
  // The 3D layers read the unquantised refs instead.
  const [pUi, setPUi] = useState(0);
  const [ms, setMs] = useState(0);
  const [boot, setBoot] = useState<"open" | "closing" | "done">("open");

  // Interactive inspection modes for the manufacturing 3D robot
  const [orbitActive, setOrbitActive] = useState(false);
  const [xrayActive, setXrayActive] = useState(false);
  const [explodedActive, setExplodedActive] = useState(false);
  const [overdriveActive, setOverdriveActive] = useState(false);

  const register = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) elsRef.current.set(id, el);
  }, []);

  const maxScroll = useCallback(() => {
    return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }, []);

  /* Enter Manufacturing Process (Smooth scroll to Layer 2).
     Target sits past CURTAIN_OUT so the gradient transition fully plays out
     instead of parking the viewport on a half-faded curtain. */
  const enterManufacturing = useCallback(() => {
    const targetY = maxScroll() * (HERO_END_P + 0.075);
    window.scrollTo({ top: targetY, behavior: "smooth" });
  }, [maxScroll]);

  /* Return to top Hero Showcase */
  const returnToOverview = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  /* URL Hash routing: ?probe=... or #how-it-works */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    const probe = Number(new URLSearchParams(window.location.search).get("probe"));
    if (hash === "#how-it-works" || hash === "#manufacturing-process") {
      setTimeout(() => enterManufacturing(), 150);
    } else if (Number.isFinite(probe) && probe > 0) {
      setTimeout(() => {
        window.scrollTo(0, probe * maxScroll());
      }, 150);
    }
  }, [enterManufacturing, maxScroll]);

  /* boot sequence */
  useEffect(() => {
    const t1 = setTimeout(() => setBoot("closing"), 1800);
    const t2 = setTimeout(() => setBoot("done"), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  /* main render & scroll loop */
  useEffect(() => {
    let raf = 0;
    let prevY = window.scrollY;
    const lastUi = { current: -1 };

    const loop = (t: number) => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const y = window.scrollY;
      const targetP = Math.min(1, Math.max(0, y / max));
      const pVal = progressRef.current + (targetP - progressRef.current) * 0.09;
      progressRef.current = Math.abs(targetP - pVal) < 0.0001 ? targetP : pVal;

      const delta = y - prevY;
      prevY = y;
      speedRef.current = speedRef.current * 0.82 + delta * 0.18;

      const q = Math.round(pVal * 240) / 240;
      if (q !== lastUi.current) {
        lastUi.current = q;
        setPUi(q);
      }
      setMs(t);

      // Map to manufacturing process coordinate: pFactory 0.0 to 1.0
      const pFactory = Math.min(1.0, Math.max(0.0, (pVal - HERO_END_P) / (1.0 - HERO_END_P)));

      // Hero sub-progress 0..1, written straight to the ref for the 3D layer
      pHeroRef.current = Math.min(1.0, Math.max(0.0, pVal / HERO_END_P));

      // Render factory background scene and update DOM elements
      const scene = sceneRef.current;
      if (scene) scene.draw(pFactory, t, speedRef.current);
      updateDomScenes(pFactory, t, elsRef.current);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* click routing for nav dots + activation buttons in manufacturing */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const act = target.closest("[data-act]") as HTMLElement | null;
      if (act) {
        e.preventDefault();
        if (act.dataset.act === "explore") {
          setOrbitActive(true);
          setOverdriveActive(true);
        } else if (act.dataset.act === "enter") {
          setOverdriveActive((prev) => !prev);
        }
        return;
      }
      const dot = target.closest("[data-dot]") as HTMLElement | null;
      if (dot) {
        const i = Number(dot.dataset.dot);
        const c = CHAPTERS[i];
        if (c) {
          const mid = (c.range[0] + c.range[1]) / 2;
          const globalP = HERO_END_P + (1.0 - HERO_END_P) * mid;
          window.scrollTo({ top: maxScroll() * globalP, behavior: "smooth" });
        }
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [maxScroll]);

  // Derived sub-progress for both layers
  const pHero = Math.min(1.0, Math.max(0.0, pUi / HERO_END_P));
  const pFactory = Math.min(1.0, Math.max(0.0, (pUi - HERO_END_P) / (1.0 - HERO_END_P)));

  // Layer transition blend — wide crossfade so there is no pop or lag
  // Hero fades OUT over a 0.08 range after HERO_END_P, Manufacturing fades IN over same range
  const FADE_W = 0.08;
  const heroOpacity = pUi < HERO_END_P ? 1 : Math.max(0, 1 - (pUi - HERO_END_P) / FADE_W);
  const manufacturingOpacity = pUi < HERO_END_P ? 0 : Math.min(1, (pUi - HERO_END_P) / FADE_W);
  const inManufacturing = pUi >= HERO_END_P;

  /* Factory-entry curtain drives straight off quantised scroll progress: the
     gradient's rise, its hold, and its dissolve are all scroll-linked, so
     scrubbing backwards replays the transition in reverse. */
  const curtainRise = smoothstep(CURTAIN_IN, CURTAIN_UP, pUi);
  const curtainAlpha = curtainRise * (1 - smoothstep(CURTAIN_PEAK, CURTAIN_OUT, pUi));
  const curtainActive = curtainAlpha > 0.004;

  return (
    <>
      {/* Scroll spacer defines the total cinematic journey length */}
      <div aria-hidden style={{ height: `${PAGE_HEIGHT_VH}vh` }} />

      {/* ============================================================== */}
      {/* LAYER 1: HERO SHOWCASE (SCROLL-DRIVEN REALISTIC HUMANOID & PANELS) */}
      {/* ============================================================== */}
      <div
        className="fixed inset-0 z-20"
        style={{
          opacity: heroOpacity,
          pointerEvents: heroOpacity > 0.05 ? "auto" : "none",
          visibility: heroOpacity > 0 ? "visible" : "hidden",
          transition: "opacity 0.6s ease, visibility 0.6s ease",
        }}
      >
        <HomepageHero
          pHero={pHero}
          pHeroRef={pHeroRef}
          onEnterManufacturing={enterManufacturing}
        />
      </div>

      {/* ============================================================== */}
      {/* LAYER 2: 3D MANUFACTURING PROCESS BAY (EXACT PRESERVED 3D CODE) */}
      {/* ============================================================== */}
      <div
        id="how-it-works"
        style={{
          opacity: manufacturingOpacity,
          visibility: manufacturingOpacity > 0 ? "visible" : "hidden",
          transition: "opacity 0.6s ease, visibility 0.6s ease",
        }}
      >
        <span id="manufacturing-process" className="absolute -top-10 opacity-0 pointer-events-none" />

        {/* Floating Return Button */}
        {inManufacturing && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
          >
            <button
              onClick={returnToOverview}
              className="flex items-center gap-2 rounded-full border border-signal/50 bg-panel/85 px-4 py-1.5 font-mono text-[10px] tracking-[0.2em] text-signal backdrop-blur-md shadow-[0_0_20px_rgba(0,229,255,0.4)] hover:bg-signal hover:text-depth transition-all cursor-pointer"
            >
              <span>&uarr;</span>
              <span>RETURN TO OVERVIEW</span>
            </button>
          </motion.div>
        )}

        {/* Background stage canvas (grid/beams) */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <SceneCanvas sceneRef={sceneRef} />
        </div>

        {/* 3D robot & futuristic manufacturing systems */}
        <div
          className={`fixed inset-0 z-[1] transition-opacity duration-700 ${
            orbitActive ? "pointer-events-auto cursor-grab active:cursor-grabbing" : "pointer-events-none"
          }`}
          style={{ opacity: pFactory > 0.04 ? 1 : Math.max(0, (pFactory - 0.01) / 0.03) }}
        >
          <Scene3D
            p={pFactory}
            ms={ms}
            orbitActive={orbitActive}
            xrayActive={xrayActive}
            explodedActive={explodedActive}
            overdriveActive={overdriveActive}
          />
        </div>

        {/* Interactive HUD controls in 3D Manufacturing Bay */}
        {pFactory > 0.04 && (
          <InspectionToolbar
            p={pFactory}
            orbitActive={orbitActive}
            onToggleOrbit={() => setOrbitActive((prev) => !prev)}
            xrayActive={xrayActive}
            onToggleXray={() => setXrayActive((prev) => !prev)}
            explodedActive={explodedActive}
            onToggleExploded={() => setExplodedActive((prev) => !prev)}
            overdriveActive={overdriveActive}
            onToggleOverdrive={() => setOverdriveActive((prev) => !prev)}
            onResetCamera={() => {
              setOrbitActive(false);
              setOverdriveActive(false);
              setXrayActive(false);
              setExplodedActive(false);
            }}
          />
        )}

        {/* Story overlays (Assembly, AI Brain, Twin, Testing, Activation) */}
        <Sections register={register} />

        {/* Atmosphere scanlines & grain */}
        <div className="pointer-events-none fixed inset-0 z-30 scanlines opacity-60" />
        <div className="pointer-events-none fixed inset-0 z-30 grain" />

        {/* Manufacturing progress bar */}
        <div className="fixed inset-x-0 top-0 z-40 h-px bg-line">
          <div
            ref={register("pbar-fill")}
            className="h-full w-full origin-left bg-gradient-to-r from-signal via-pass to-violet shadow-[0_0_12px_rgba(0,229,255,0.8)]"
          />
        </div>

        {/* Live telemetry ticker strip */}
        <div className="fixed inset-x-0 top-1 z-40 h-6 overflow-hidden pointer-events-none select-none">
          <div className="ticker-track flex items-center h-full text-[9px] font-mono tracking-[0.18em] text-mute/50">
            {Array.from({ length: 2 }).map((_, rep) => (
              <span key={rep} className="flex items-center gap-6 pr-6">
                {[
                  ["UNIT·TEMP", "72.4°C"],
                  ["ARM·L·LOAD", "18.2kg"],
                  ["ARM·R·LOAD", "19.1kg"],
                  ["ACTUATOR·V", "48.2V"],
                  ["VISOR·CAM", "60fps"],
                  ["COOLANT·FLOW", "4.2L/m"],
                  ["CPU·UTIL", "78%"],
                  ["WELD·AMP", "420A"],
                  ["ALLOY·FEED", "2.4mm"],
                  ["UNITS·TODAY", "412/847"],
                  ["UPTIME", "99.2%"],
                  ["AI·CONF", "99.8%"],
                ].map(([k, v]) => (
                  <span key={k} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-signal/40" />
                    <span className="text-mute/40">{k}</span>
                    <span className="text-signal/60">{v}</span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* Manufacturing Header */}
        <header className="fixed inset-x-0 top-0 z-40 flex items-start justify-between px-5 pt-5 sm:px-8 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 rounded-r-md border border-l border-linesoft/0 bg-panel/30 py-1.5 pr-4 pl-2 backdrop-blur-md">
            <span className="grid h-9 w-9 place-items-center rounded-md border border-signal/40 bg-signal/5">
              <span className="block h-2.5 w-2.5 bg-signal" style={{ boxShadow: "0 0 10px rgba(0,229,255,0.9)" }} />
            </span>
            <div className="leading-tight">
              <span className="block font-mono text-[11px] tracking-[0.3em] text-ink">
                APEX <span className="text-signal">{"||"}</span> ROBOTICS
              </span>
              <span className="hud-label mt-0.5 block">BIO-SYNTHETIC FOUNDRY</span>
            </div>
          </div>
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-l-md border border-linesoft bg-panel/30 px-3 py-1.5 pt-2 backdrop-blur-md">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pass/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-pass" />
            </span>
            <span className="hud-label text-mute">SYSTEM: ONLINE</span>
          </div>
        </header>

        {/* Right Section Rail Dots */}
        <AnimatePresence>
          {pFactory > 0.04 && (
            <motion.nav
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 14 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="fixed right-4 top-[27.5vh] z-50 -translate-y-1/2 sm:right-8"
            >
              <div className="glass relative flex flex-col gap-7 rounded-lg py-5 pl-4 pr-2">
                <div ref={register("rail-fill")} className="absolute bottom-[22px] left-[15px] top-[22px]" />
                {CHAPTERS.map((c, i) => (
                  <button
                    key={c.key}
                    type="button"
                    data-dot={i}
                    ref={register(`rail-dot-${String(i + 1).padStart(2, "0")}`)}
                    className={`relative z-10 flex items-center gap-3 outline-none ${
                      i === 0 ? "text-signal opacity-100" : "opacity-30"
                    } hover:opacity-100`}
                    style={{ transition: "opacity .3s" }}
                    aria-label={`Go to section ${c.num} — ${c.name}`}
                  >
                    <span className="block h-[9px] w-[9px] rounded-full bg-current shadow-[0_0_8px_currentColor]" />
                    <span className="hud-label hidden pr-1 text-ink/80 sm:inline-block">
                      <span className="text-current">{c.num}</span> / {c.name}
                    </span>
                  </button>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>

        {/* Bottom Chrome HUD */}
        <div className="fixed bottom-4 left-6 z-40 flex items-center gap-3 sm:left-8">
          <span ref={register("hud-num")} className="hud-label text-signal">
            01
          </span>
          <span className="h-3 w-px bg-line" />
          <span ref={register("hud-name")} className="hud-label text-mute">
            FACTORY
          </span>
        </div>
        <div className="fixed bottom-6 right-6 z-40 text-right sm:right-8">
          <span ref={register("coords")} className="hud-label text-mute">
            0.00 · 00.00 / 00.00
          </span>
          <span className="hud-label mt-1 block text-mute/70">
            CAM 01 · SLATE 08 · 4K
          </span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* FACTORY ENTRY CURTAIN — colourful gradient rising from the bottom  */}
      {/* ============================================================== */}
      {curtainActive && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[45] overflow-hidden"
          style={{ opacity: curtainAlpha }}
        >
          {/* the gradient field itself, sliding up from below the fold */}
          <div
            className="factory-curtain__field absolute inset-x-0 bottom-0 h-[118%] origin-bottom will-change-transform"
            style={{ transform: `translate3d(0, ${(1 - curtainRise) * 100}%, 0)` }}
          >
            {/* falling light streaks for the sense of dropping into the bay */}
            {STREAKS.map((s, i) => (
              <span
                key={i}
                className="factory-streak absolute bottom-0"
                style={{
                  left: s.left,
                  width: s.w,
                  height: s.h,
                  animationDuration: s.dur,
                  animationDelay: s.delay,
                }}
              />
            ))}

            {/* glowing rule riding the leading edge of the gradient */}
            <span
              className="factory-edge absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  "linear-gradient(to right, transparent, rgba(77,255,176,0.9) 18%, #00e5ff 50%, rgba(139,123,255,0.9) 82%, transparent)",
              }}
            />
          </div>

          {/* copy sits above the field so it stays legible at full saturation */}
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            {/* soft scrim: the gradient's upper stops are intentionally
                translucent, so the words need their own contrast floor */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 62% 40% at 50% 50%, rgba(4,6,10,0.88) 0%, rgba(4,6,10,0.62) 52%, rgba(4,6,10,0) 78%)",
              }}
            />

            {/* indeterminate handover bar */}
            <div
              className="factory-word relative mt-4 h-px w-40 overflow-hidden bg-line sm:w-56"
              style={{ animationDelay: "660ms" }}
            >
              <span
                className="block h-full w-full origin-left bg-gradient-to-r from-signal via-pass to-violet"
                style={{
                  animation: "shimmer 1.5s cubic-bezier(0.65,0,0.35,1) infinite",
                  transform: "scaleX(0.34)",
                }}
              />
            </div>

            {/* the curtain is scroll-linked, so tell the viewer to keep going */}
            <div
              className="factory-word relative mt-8 flex flex-col items-center gap-1.5"
              style={{ animationDelay: "820ms" }}
            >
              <span className="hud-label text-mute/70">KEEP SCROLLING TO DESCEND</span>
              <span
                className="text-[11px] leading-none text-signal/80"
                style={{ animation: "factoryChevron 1.5s ease-in-out infinite" }}
              >
                &#9660;
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Boot screen sequence ---------- */}
      {boot !== "done" && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-depth transition-opacity duration-500 ${
            boot === "closing" ? "pointer-events-none opacity-0" : ""
          }`}
          onClick={() => setBoot("done")}
        >
          <div className="flex flex-col items-center px-6">
            <div className="mb-2 flex items-center gap-3 self-start sm:self-center">
              <span className="grid h-9 w-9 place-items-center rounded-md border border-signal/50 bg-signal/5">
                <span className="block h-2.5 w-2.5 bg-signal" style={{ boxShadow: "0 0 12px rgba(0,229,255,0.9)" }} />
              </span>
              <span className="font-mono text-[12px] tracking-[0.28em] text-ink">
                APEX ROBOTICS <span className="text-signal">{"||"}</span> FOUNDRY
              </span>
            </div>
            <BootLoader />
            <div className="mt-7 flex items-center gap-2 font-mono text-[9px] tracking-[0.22em] text-mute/70">
              <span className="h-1 w-1 rounded-full bg-signal hud-blink" />
              SEALING TEST CHAMBER · CALIBRATING SENSOR ARRAY
            </div>
          </div>
        </div>
      )}
    </>
  );
}