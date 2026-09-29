"use client";

import { memo, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HumanoidCanvas } from "./HumanoidCanvas";

interface HomepageHeroProps {
  /** Quantised value, only used to switch DOM copy/cards. */
  pHero: number;
  /** Unquantised value read every frame inside the 3D scene. */
  pHeroRef: React.RefObject<number>;
  onEnterManufacturing: () => void;
}

const STEPS = [
  { num: "01", name: "FACTORY", label: "FOUNDRY OVERVIEW", subtitle: "STAGE 01/05 • CLEANROOM FOUNDRY — ISO CLASS 5" },
  { num: "02", name: "ASSEMBLY", label: "ROBOT ASSEMBLY", subtitle: "STAGE 02/05 • ROBOT ASSEMBLY — 42 N·M SCREW FITTING" },
  { num: "03", name: "AI BRAIN", label: "SYNAPTIC CORTEX", subtitle: "STAGE 03/05 • AI BRAIN — 70B PARAMETER NEURAL CORE" },
  { num: "04", name: "DYNAMICS", label: "AGILITY TESTING", subtitle: "STAGE 04/05 • DYNAMICS — AGILITY STRESS TESTING" },
  { num: "05", name: "CERTIFIED", label: "SYSTEM DEPLOYMENT", subtitle: "STAGE 05/05 • PRODUCTION CERTIFIED & SYSTEM ARMED" },
];

function BentoCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/20 bg-slate-950/80 p-5 backdrop-blur-2xl shadow-[0_16px_44px_rgba(0,0,0,0.75),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:border-[#00e5ff]/50 transition-all duration-300 flex flex-col ${className}`}>
      {children}
    </div>
  );
}

export const HomepageHero = memo(function HomepageHero({ pHero, pHeroRef, onEnterManufacturing }: HomepageHeroProps) {
  const [interactiveOrbit, setInteractiveOrbit] = useState(false);
  const [tickerTime, setTickerTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTickerTime(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeStep = useMemo(() => {
    if (pHero < 0.20) return 1;
    if (pHero < 0.40) return 2;
    if (pHero < 0.60) return 3;
    if (pHero < 0.80) return 4;
    return 5;
  }, [pHero]);

  // Cards only appear after some scroll
  const showCards = pHero > 0.04;
  const cardEntryProgress = Math.min(1, (pHero - 0.04) / 0.08);

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden bg-[#020508] text-white select-none flex flex-col">
      {/* Cinematic background gradients */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_30%,rgba(0,229,255,0.055),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,rgba(120,80,255,0.04),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,229,255,0.03),transparent_55%)]" />
      {/* Subtle scanlines */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.02]" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.5) 3px, rgba(255,255,255,0.5) 4px)" }} />

      {/* ===== HEADER — no step tabs ===== */}
      <header className="relative z-30 flex items-center justify-between px-6 pt-6 sm:px-12 pointer-events-auto flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#00e5ff]" style={{ boxShadow: "0 0 10px rgba(0,229,255,0.9)" }} />
            <span className="font-mono text-base font-bold tracking-[0.28em] text-white">APEX</span>
          </div>
          <span className="h-3 w-px bg-white/20" />
          <span className="font-mono text-xs tracking-[0.2em] text-white/50">ROBOTICS &bull; 2026</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setInteractiveOrbit((prev) => !prev)}
            className={`hidden sm:flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-xs tracking-[0.16em] transition-all cursor-pointer ${interactiveOrbit ? "border-[#00e5ff] bg-[#00e5ff]/15 text-[#00e5ff] shadow-[0_0_20px_rgba(0,229,255,0.4)]" : "border-white/10 bg-white/5 text-white/60 hover:text-white hover:border-white/25"}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${interactiveOrbit ? "bg-[#00e5ff] animate-ping" : "bg-white/40"}`} />
            {interactiveOrbit ? "360° ACTIVE" : "360° VIEW"}
          </button>
          <button
            onClick={onEnterManufacturing}
            className="group flex items-center gap-2 rounded-full border border-[#00e5ff]/40 bg-[#00e5ff]/10 px-5 py-2 font-mono text-xs font-bold tracking-[0.2em] text-[#00e5ff] shadow-[0_0_20px_rgba(0,229,255,0.2)] transition-all hover:bg-[#00e5ff] hover:text-[#020508] hover:shadow-[0_0_40px_rgba(0,229,255,0.7)] cursor-pointer"
          >
            <span>HOW IT WORKS</span>
            <span className="transition-transform duration-300 group-hover:translate-y-0.5">↓</span>
          </button>
        </div>
      </header>

      {/* ===== GIANT BACKGROUND TITLE ===== */}
      <div className="pointer-events-none absolute inset-x-0 top-[8vh] z-0 flex flex-col items-center text-center">
        <motion.div
          animate={{ scale: activeStep === 2 ? 0.94 : activeStep === 3 ? 0.93 : activeStep === 5 ? 1.05 : 1.0, y: activeStep === 3 ? -8 : activeStep === 5 ? 6 : 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center"
        >
          <h1
            className="font-sans font-black leading-[0.82] tracking-tighter uppercase select-none"
            style={{ fontSize: "clamp(80px, 17vw, 220px)", background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.5) 60%, rgba(0,229,255,0.06) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", filter: "drop-shadow(0 20px 60px rgba(0,0,0,0.9))" }}
          >
            APEX ROBOTICS
          </h1>
          <AnimatePresence mode="wait">
            {showCards ? (
              <motion.span key={activeStep} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.5 }} className="font-mono text-xs sm:text-sm tracking-[0.45em] uppercase text-white/50 mt-3 font-semibold">
                {STEPS[activeStep - 1].subtitle}
              </motion.span>
            ) : (
              <motion.span key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, delay: 0.4 }} className="font-mono text-xs sm:text-sm tracking-[0.45em] uppercase text-white/40 mt-3 font-semibold">
                INTELLIGENCE BUILT &bull; SCROLL TO EXPLORE
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ===== 3D ROBOT CANVAS ===== */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <HumanoidCanvas
          progress={pHeroRef}
          interactiveOrbit={interactiveOrbit}
        />
      </div>

      {/* ===== CONTENT PANELS — scroll driven ===== */}
      <div className="relative z-20 flex-1 flex items-center pointer-events-none">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-0 px-4 sm:px-8 lg:px-12">

          {/* LEFT PANEL */}
          <div className="lg:col-span-5 flex flex-col justify-center gap-4 py-4 pointer-events-auto">
            <AnimatePresence mode="wait">
              {showCards && activeStep === 1 && (
                <motion.div key="left-1" initial={{ opacity: 0, x: -50, filter: "blur(8px)" }} animate={{ opacity: cardEntryProgress, x: 0, filter: "blur(0px)" }} exit={{ opacity: 0, x: -40, filter: "blur(6px)" }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-3.5 max-w-[420px] w-full">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#00e5ff]" />
                    <span className="font-mono text-xs font-bold tracking-[0.3em] text-[#00e5ff] uppercase">CHASSIS &amp; SHELL</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[{ value: "1,200m²", label: "Cleanroom" }, { value: "847", label: "Units/Day" }, { value: "99.2%", label: "Uptime" }].map((item) => (
                      <BentoCard key={item.label} className="p-3">
                        <span className="font-sans text-xl sm:text-2xl font-black text-white leading-tight">{item.value}</span>
                        <span className="font-mono text-[10px] text-white/50 mt-1 uppercase tracking-wider font-semibold">{item.label}</span>
                      </BentoCard>
                    ))}
                  </div>
                  <BentoCard className="p-5">
                    <span className="font-mono text-sm sm:text-base font-bold text-white block mb-2">Forged Titanium Spine</span>
                    <p className="font-sans text-xs sm:text-sm text-white/80 leading-relaxed font-normal">The load-bearing frame is forged from a single Ti-6Al-4V billet, then stress-relieved so the full 78 kg carries every dynamic load without fatigue.</p>
                  </BentoCard>
                </motion.div>
              )}

              {showCards && activeStep === 3 && (
                <motion.div key="left-3" initial={{ opacity: 0, x: -50, filter: "blur(8px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} exit={{ opacity: 0, x: -40, filter: "blur(6px)" }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-3.5 max-w-[420px] w-full">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#00e5ff] animate-ping" />
                    <span className="font-mono text-xs font-bold tracking-[0.3em] text-[#00e5ff] uppercase">NEURAL ARCHITECTURE</span>
                  </div>
                  {[
                    { title: "12,000 Hrs Human Motion", body: "A closed-loop transformer policy streams real manipulation and walking into memory, so the robot learns new tasks from demonstration." },
                    { title: "4.2 ms Sensorimotor Reflex", body: "The balance and safety envelope is recomputed 240 times a second, reacting faster than a human blink." },
                  ].map((card) => (
                    <BentoCard key={card.title} className="p-5">
                      <span className="font-mono text-sm sm:text-base font-bold text-white block mb-2">{card.title}</span>
                      <p className="font-sans text-xs sm:text-sm text-white/80 leading-relaxed font-normal">{card.body}</p>
                    </BentoCard>
                  ))}
                </motion.div>
              )}

              {showCards && activeStep === 5 && (
                <motion.div key="left-5" initial={{ opacity: 0, x: -50, filter: "blur(8px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} exit={{ opacity: 0, x: -40, filter: "blur(6px)" }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-3.5 max-w-[420px] w-full">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 10px rgba(52,211,153,0.9)" }} />
                    <span className="font-mono text-xs font-bold tracking-[0.3em] text-emerald-400 uppercase">PRODUCTION CERTIFIED</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[{ value: "1.82 m", label: "Full Scale" }, { value: "78 kg", label: "Chassis Mass" }].map((item) => (
                      <BentoCard key={item.label} className="p-4">
                        <span className="font-sans text-2xl sm:text-3xl font-black text-white leading-tight">{item.value}</span>
                        <span className="font-mono text-[10px] text-white/50 mt-1 uppercase tracking-wider font-semibold">{item.label}</span>
                      </BentoCard>
                    ))}
                  </div>
                  <BentoCard className="p-5">
                    <span className="font-mono text-sm sm:text-base font-bold text-white block mb-2">42 Degrees of Freedom</span>
                    <p className="font-sans text-xs sm:text-sm text-white/80 leading-relaxed font-normal">A white ceramic shell over mirror-chrome hydraulic musculature, with force-limited joints that make contact safe around people.</p>
                  </BentoCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Middle — robot stands */}
          <div className="hidden lg:block lg:col-span-2" />

          {/* RIGHT PANEL */}
          <div className="lg:col-span-5 flex flex-col justify-center gap-4 py-4 pointer-events-auto items-end">
            <AnimatePresence mode="wait">
              {showCards && activeStep === 2 && (
                <motion.div key="right-2" initial={{ opacity: 0, x: 50, filter: "blur(8px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} exit={{ opacity: 0, x: 40, filter: "blur(6px)" }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-3.5 max-w-[420px] w-full">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="font-mono text-xs font-bold tracking-[0.3em] text-[#00e5ff] uppercase">FABRICATION LINE &bull; ACTIVE</span>
                    <span className="h-2 w-2 rounded-full bg-[#00e5ff] animate-ping" />
                  </div>
                  {[
                    { title: "01 • CERAMIC SHELL", value: "420 kN", body: "2.4mm Grade 5 aerospace Ti-Al plate cold-pressed into the white ceramic body shell, then autoclave-cured for scratch and heat resistance." },
                    { title: "02 • ARTICULATED HANDS", value: "16 DOF", body: "Each 5-finger hand is machined to 42 N·m fingertip torque, driven by independent micro-actuators for sub-millimeter grasp control." },
                  ].map((card) => (
                    <BentoCard key={card.title} className="p-5 border-[#00e5ff]/30 shadow-[0_16px_40px_rgba(0,229,255,0.15)]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs sm:text-sm font-bold text-white tracking-widest">{card.title}</span>
                        <span className="font-sans text-base sm:text-lg font-black text-[#00e5ff]">{card.value}</span>
                      </div>
                      <p className="font-sans text-xs sm:text-sm text-white/80 leading-relaxed font-normal">{card.body}</p>
                    </BentoCard>
                  ))}
                </motion.div>
              )}

              {showCards && activeStep === 4 && (
                <motion.div key="right-4" initial={{ opacity: 0, x: 50, filter: "blur(8px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} exit={{ opacity: 0, x: 40, filter: "blur(6px)" }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-3.5 max-w-[420px] w-full">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="font-mono text-xs font-bold tracking-[0.3em] text-[#00e5ff] uppercase">ELECTRICAL &amp; DYNAMICS</span>
                    <span className="h-2 w-2 rounded-full bg-[#00e5ff]" />
                  </div>
                  <BentoCard className="p-5">
                    <span className="font-mono text-xs sm:text-sm font-bold text-white/60 block mb-1 uppercase tracking-wider">Solid-State Power Bus</span>
                    <span className="font-sans text-3xl sm:text-4xl font-black text-white block mb-2">48 Hours</span>
                    <p className="font-sans text-xs sm:text-sm text-white/80 leading-relaxed font-normal">Rapid 15-minute wireless inductive charge with 48.2V high-discharge bus &amp; dynamic torque vectoring.</p>
                  </BentoCard>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[{ value: "0.6m", label: "Leap" }, { value: "450N.m", label: "Damper" }, { value: "100%", label: "QA" }].map((item) => (
                      <BentoCard key={item.label} className="p-3">
                        <span className="font-sans text-xl sm:text-2xl font-black text-white leading-tight">{item.value}</span>
                        <span className="font-mono text-[10px] text-white/50 mt-1 uppercase tracking-wider font-semibold">{item.label}</span>
                      </BentoCard>
                    ))}
                  </div>
                </motion.div>
              )}

              {showCards && activeStep === 5 && (
                <motion.div key="right-5" initial={{ opacity: 0, x: 50, filter: "blur(8px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} exit={{ opacity: 0, x: 40, filter: "blur(6px)" }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col gap-3.5 max-w-[420px] w-full">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="font-mono text-xs font-bold tracking-[0.3em] text-emerald-400 uppercase">SYSTEM ARMED &amp; READY</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 10px rgba(52,211,153,0.9)" }} />
                  </div>
                  <BentoCard className="p-5 border-emerald-500/40 shadow-[0_16px_40px_rgba(16,185,129,0.15)]">
                    <span className="font-mono text-xs sm:text-sm font-bold text-white/60 block mb-1 uppercase tracking-wider">Repulsor &amp; Telemetry Status</span>
                    <span className="font-sans text-3xl sm:text-4xl font-black text-emerald-400 block mb-2">ARMED • 100%</span>
                    <p className="font-sans text-xs sm:text-sm text-white/80 leading-relaxed font-normal">Full system lock complete. Autonomous navigation and dual-arm manipulation initialized.</p>
                  </BentoCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ===== BOTTOM HUD ===== */}
      <footer className="relative z-30 px-6 sm:px-12 pb-5 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-4 font-mono text-xs text-white/50 tracking-[0.2em]">
          <span className="text-[#00e5ff]/80 font-bold">SYSTEM: ONLINE</span>
        </div>
        <div className="flex items-center gap-4 font-mono text-xs text-white/50 tracking-[0.2em]">
          <span>LOCAL {tickerTime}</span>
        </div>
      </footer>
    </div>
  );
});
