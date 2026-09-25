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

const PAGE_HEIGHT_VH = 720;

export function Experience() {
  const elsRef = useRef(new Map<string, HTMLElement>());
  const sceneRef = useRef<Scene | null>(null);
  const speedRef = useRef(0);
  const progressRef = useRef(0);
  const [p, setP] = useState(0);
  const [ms, setMs] = useState(0);
  const [boot, setBoot] = useState<"open" | "closing" | "done">("open");

  // Interactive inspection modes
  const [orbitActive, setOrbitActive] = useState(false);
  const [xrayActive, setXrayActive] = useState(false);
  const [explodedActive, setExplodedActive] = useState(false);
  const [overdriveActive, setOverdriveActive] = useState(false);

  const register = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) elsRef.current.set(id, el);
  }, []);

  /* QA: ?probe=0.5 jumps to a scroll fraction */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const probe = Number(new URLSearchParams(window.location.search).get("probe"));
    if (Number.isFinite(probe) && probe > 0) {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      window.scrollTo(0, probe * max);
    }
  }, []);

  /* boot sequence */
  useEffect(() => {
    const t1 = setTimeout(() => setBoot("closing"), 1800);
    const t2 = setTimeout(() => setBoot("done"), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  /* main render loop */
  useEffect(() => {
    let raf = 0;
    let prevY = window.scrollY;
    const loop = (t: number) => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const y = window.scrollY;
      const targetP = Math.min(1, Math.max(0, y / max));
      const p = progressRef.current + (targetP - progressRef.current) * 0.09;
      progressRef.current = Math.abs(targetP - p) < 0.0001 ? targetP : p;
      const delta = y - prevY;
      prevY = y;
      speedRef.current = speedRef.current * 0.82 + delta * 0.18;
      setP(p);
      setMs(t);
      const scene = sceneRef.current;
      if (scene) scene.draw(p, t, speedRef.current);
      updateDomScenes(p, t, elsRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* click routing for nav dots + activation buttons */
  useEffect(() => {
    const maxScroll = () =>
      Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
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
          window.scrollTo({ top: maxScroll() * mid, behavior: "smooth" });
        }
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      {/* scroll spacer defines the journey length */}
      <div aria-hidden style={{ height: `${PAGE_HEIGHT_VH}vh` }} />

      {/* stage — background canvas (grid/beams only) */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <SceneCanvas sceneRef={sceneRef} />
      </div>
      {/* 3D robot & futuristic manufacturing systems */}
      <div
        className={`fixed inset-0 z-[1] transition-opacity duration-700 ${orbitActive ? "pointer-events-auto cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
        style={{ opacity: p > 0.04 ? 1 : Math.max(0, (p - 0.01) / 0.03) }}
      >
        <Scene3D
          p={p}
          ms={ms}
          orbitActive={orbitActive}
          xrayActive={xrayActive}
          explodedActive={explodedActive}
          overdriveActive={overdriveActive}
        />
      </div>

      {/* Interactive HUD controls — hidden on landing, slides in after first scroll */}
      {p > 0.04 && (
        <InspectionToolbar
          p={p}
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

      {/* story overlays */}
      <Sections register={register} />

      {/* atmosphere */}
      <div className="pointer-events-none fixed inset-0 z-30 scanlines opacity-60" />
      <div className="pointer-events-none fixed inset-0 z-30 grain" />

      {/* ---------- top progress + header ---------- */}
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

      <header className="fixed inset-x-0 top-0 z-40 flex items-start justify-between px-5 pt-5 sm:px-8">
        <div className="flex items-center gap-3 rounded-r-md border border-l border-linesoft/0 bg-panel/30 py-1.5 pr-4 pl-2 backdrop-blur-md">
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
        <div className="flex items-center gap-2.5 rounded-l-md border border-linesoft bg-panel/30 px-3 py-1.5 pt-2 backdrop-blur-md">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pass/70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-pass" />
          </span>
          <span className="hud-label text-mute">SYSTEM: ONLINE</span>
        </div>
      </header>

      {/* ---------- right section rail — only after slight scroll ---------- */}
      <AnimatePresence>
        {p > 0.04 && (
          <motion.nav
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 14 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-4 top-[27.5vh] z-50 -translate-y-1/2 sm:right-8"
          >
            <div className="glass relative flex flex-col gap-7 rounded-lg py-5 pl-4 pr-2">
              <div ref={register("rail-fill")} className="absolute bottom-[22px] left-[15px] top-[22px] " />
              {CHAPTERS.map((c, i) => (
                <button
                  key={c.key}
                  type="button"
                  data-dot={i}
                  ref={register(`rail-dot-${String(i + 1).padStart(2, "0")}`)}
                  className={`relative z-10 flex items-center gap-3 outline-none ${i === 0 ? "text-signal opacity-100" : "opacity-30"} hover:opacity-100`}
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

      {/* ---------- bottom chrome ---------- */}
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

      {/* ---------- boot ---------- */}
      {boot !== "done" && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-depth transition-opacity duration-500 ${boot === "closing" ? "pointer-events-none opacity-0" : ""
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