"use client";

import { motion, AnimatePresence } from "framer-motion";

interface InspectionToolbarProps {
  p: number;
  orbitActive: boolean;
  onToggleOrbit: () => void;
  xrayActive: boolean;
  onToggleXray: () => void;
  explodedActive: boolean;
  onToggleExploded: () => void;
  overdriveActive: boolean;
  onToggleOverdrive: () => void;
  onResetCamera?: () => void;
}

export function InspectionToolbar({
  orbitActive,
  onToggleOrbit,
  xrayActive,
  onToggleXray,
  explodedActive,
  onToggleExploded,
  overdriveActive,
  onToggleOverdrive,
  onResetCamera,
}: InspectionToolbarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4">
      {/* Dynamic guidance tooltip when Orbit mode is active */}
      <AnimatePresence>
        {orbitActive && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="flex items-center gap-2 rounded-full border border-signal/40 bg-depth/90 px-3.5 py-1 text-[10px] font-mono tracking-widest text-signal shadow-[0_0_16px_rgba(0,229,255,0.25)] backdrop-blur-md"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal/70" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
            </span>
            <span>DRAG TO ROTATE · SCROLL TO ZOOM · DOUBLE-CLICK TO ANIMATE</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main futuristic floating control dock — always visible in all sections */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-auto flex max-w-full items-center gap-1.5 sm:gap-2 rounded-full border border-linesoft/80 bg-panel/90 p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_24px_rgba(0,229,255,0.12)] backdrop-blur-xl transition-all duration-300 hover:border-signal/40"
      >
        {/* Telemetry status badge */}
        <div className="hidden sm:flex items-center gap-2 pl-3 pr-2 py-1 border-r border-line">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pass/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-pass" />
          </span>
          <span className="font-mono text-[9px] tracking-[0.22em] text-ink/70">APEX</span>
        </div>

        {/* 1. 360 Orbit Drag Toggle */}
        <button
          type="button"
          onClick={onToggleOrbit}
          title="Toggle free 360-degree rotation view"
          className={`group relative flex items-center gap-2 rounded-full px-3 sm:px-4 py-2 font-mono text-[10px] tracking-wider transition-all duration-300 ${orbitActive
              ? "bg-signal text-depth font-bold shadow-[0_0_16px_rgba(0,229,255,0.7)]"
              : "text-ink/80 hover:bg-white/10 hover:text-signal"
            }`}
        >
          <span className={`inline-block transition-transform duration-500 ${orbitActive ? "rotate-180" : "group-hover:rotate-90"}`}>
            💫
          </span>
          <span>{orbitActive ? "360° ACTIVE" : "360° VIEW"}</span>
        </button>

        {/* 2. Neural X-Ray Matrix Toggle */}
        <button
          type="button"
          onClick={onToggleXray}
          title="See internal titanium chassis, hydraulic pistons, and neural core"
          className={`flex items-center gap-2 rounded-full px-3 sm:px-3.5 py-2 font-mono text-[10px] tracking-wider transition-all duration-300 ${xrayActive
              ? "bg-violet text-ink font-bold shadow-[0_0_16px_rgba(139,123,255,0.8)]"
              : "text-ink/80 hover:bg-white/10 hover:text-violet"
            }`}
        >
          <span>🧠</span>
          <span className="hidden xs:inline">X-RAY</span>
          <span className="hidden md:inline">NEURAL CORE</span>
        </button>

        {/* 3. CAD Exploded View Toggle */}
        <button
          type="button"
          onClick={onToggleExploded}
          title="Expand precision armor panels outward along assembly vectors"
          className={`flex items-center gap-2 rounded-full px-3 sm:px-3.5 py-2 font-mono text-[10px] tracking-wider transition-all duration-300 ${explodedActive
              ? "bg-pass text-depth font-bold shadow-[0_0_16px_rgba(77,255,176,0.8)]"
              : "text-ink/80 hover:bg-white/10 hover:text-pass"
            }`}
        >
          <span>💥</span>
          <span className="hidden xs:inline">CAD</span>
          <span className="hidden md:inline">ASSEMBLY</span>
        </button>

        {/* 4. Overdrive Combat Mode Toggle */}
        <button
          type="button"
          onClick={onToggleOverdrive}
          title="Ignite plasma reactor surges and combat optics"
          className={`flex items-center gap-2 rounded-full px-3 sm:px-3.5 py-2 font-mono text-[10px] tracking-wider transition-all duration-300 ${overdriveActive
              ? "bg-fault text-ink font-bold shadow-[0_0_18px_rgba(255,92,92,0.9)]"
              : "text-ink/80 hover:bg-white/10 hover:text-fault"
            }`}
        >
          <span>⚡</span>
          <span>PERFORMANCE</span>
        </button>

        {/* Optional Reset Camera button when Orbit is active */}
        {orbitActive && onResetCamera && (
          <button
            type="button"
            onClick={onResetCamera}
            title="Reset to scroll-guided camera"
            className="flex items-center gap-1.5 rounded-full border border-line/50 bg-white/5 px-2.5 py-2 font-mono text-[9px] tracking-wider text-mute hover:bg-white/15 hover:text-ink transition-colors"
          >
            <span className="hidden sm:inline">RESET</span>
          </button>
        )}
      </motion.div>
    </div>
  );
}
