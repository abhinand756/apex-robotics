"use client";

import { memo, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HumanoidCanvas } from "./HumanoidCanvas";

interface HomepageHeroProps {
  pHero: number;
  pHeroRef: React.RefObject<number>;
  onEnterManufacturing: () => void;
}

const STEPS = [
  { num: "01", name: "FACTORY",   subtitle: "STAGE 01/05 • CLEANROOM FOUNDRY — ISO CLASS 5" },
  { num: "02", name: "ASSEMBLY",  subtitle: "STAGE 02/05 • ROBOT ASSEMBLY — 42 N·M SCREW FITTING" },
  { num: "03", name: "AI BRAIN",  subtitle: "STAGE 03/05 • AI BRAIN — 70B PARAMETER NEURAL CORE" },
  { num: "04", name: "DYNAMICS",  subtitle: "STAGE 04/05 • DYNAMICS — AGILITY STRESS TESTING" },
  { num: "05", name: "CERTIFIED", subtitle: "STAGE 05/05 • PRODUCTION CERTIFIED & SYSTEM ARMED" },
];

/* ── Primitives ─────────────────────────────────────────────────────────────── */

function Glass({ children, className = "", accent = "cyan", glow = false }: {
  children: React.ReactNode; className?: string; accent?: "cyan"|"emerald"|"violet"|"amber"; glow?: boolean;
}) {
  const a: Record<string,string> = { cyan:"rgba(0,229,255,", emerald:"rgba(52,211,153,", violet:"rgba(139,92,246,", amber:"rgba(251,191,36," };
  const c = a[accent];
  return (
    <div className={`relative rounded-2xl border backdrop-blur-2xl flex flex-col overflow-hidden ${className}`}
      style={{
        background:"linear-gradient(135deg,rgba(2,10,20,0.9) 0%,rgba(5,18,35,0.85) 100%)",
        borderColor:`${c}0.22)`,
        boxShadow: glow
          ? `0 0 0 1px ${c}0.12),0 20px 60px rgba(0,0,0,0.8),inset 0 1px 0 rgba(255,255,255,0.06),0 0 40px ${c}0.2)`
          : `0 0 0 1px ${c}0.08),0 16px 48px rgba(0,0,0,0.75),inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}>
      <div className="absolute inset-x-0 top-0 h-px"
        style={{background:`linear-gradient(90deg,transparent,${c}0.5) 30%,${c}0.5) 70%,transparent)`}} />
      {children}
    </div>
  );
}

function Bar({ pct, color="#00e5ff", delay=0 }: { pct:number; color?:string; delay?:number }) {
  return (
    <div className="h-1 w-full rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.07)"}}>
      <motion.div className="h-full rounded-full"
        initial={{width:0}} animate={{width:`${pct}%`}}
        transition={{duration:1.1, delay, ease:[0.22,1,0.36,1]}}
        style={{background:`linear-gradient(90deg,${color}88,${color})`,boxShadow:`0 0 8px ${color}`}} />
    </div>
  );
}

function Chip({ children, color="#00e5ff" }: { children:React.ReactNode; color?:string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[9px] tracking-[0.22em] uppercase font-bold"
      style={{background:`${color}18`,color,border:`1px solid ${color}35`}}>
      {children}
    </span>
  );
}

function Dot({ color="#00e5ff", pulse=true }: { color?:string; pulse?:boolean }) {
  return (
    <span className="relative flex h-2 w-2 flex-shrink-0">
      {pulse && <span className="absolute inline-flex h-full w-full rounded-full animate-ping opacity-50" style={{backgroundColor:color}} />}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{backgroundColor:color,boxShadow:`0 0 8px ${color}`}} />
    </span>
  );
}

function Stat({ value, label, color="#00e5ff", sub }: { value:string; label:string; color?:string; sub?:string }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono font-black text-xl sm:text-2xl leading-tight" style={{color,textShadow:`0 0 20px ${color}88`}}>{value}</span>
      <span className="font-mono text-[9px] tracking-[0.22em] text-white/40 uppercase mt-0.5">{label}</span>
      {sub && <span className="font-mono text-[8px] tracking-[0.14em] text-white/25 mt-0.5">{sub}</span>}
    </div>
  );
}

function SpecRow({ label, value, pct, color="#00e5ff", delay=0 }: { label:string; value:string; pct?:number; color?:string; delay?:number }) {
  return (
    <motion.div initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{duration:0.4,delay}} className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.14em] text-white/40 uppercase">{label}</span>
        <span className="font-mono text-[10px] font-bold tracking-[0.12em]" style={{color}}>{value}</span>
      </div>
      {pct !== undefined && <Bar pct={pct} color={color} delay={delay+0.1} />}
    </motion.div>
  );
}

function StageRail({ active }: { active:number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      {STEPS.map((s,i) => {
        const cur = i+1 === active;
        const done = i+1 < active;
        return (
          <motion.div key={s.num} className="flex items-center gap-2"
            animate={{opacity: cur ? 1 : done ? 0.55 : 0.22}}>
            <motion.div className="h-1.5 rounded-full"
              animate={{width: cur ? 20 : 6, backgroundColor: cur ? "#00e5ff" : done ? "#00e5ff88" : "#ffffff25"}}
              style={{boxShadow: cur ? "0 0 8px #00e5ff" : "none"}} />
            <span className="font-mono text-[8px] tracking-[0.24em] uppercase"
              style={{color: cur ? "#00e5ff" : "rgba(255,255,255,0.28)"}}>
              {s.num}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ── Stage panels ───────────────────────────────────────────────────────────── */

function Stage01() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-[430px]">
      <div className="flex items-center gap-2">
        <Dot color="#00e5ff" />
        <span className="font-mono text-[10px] font-bold tracking-[0.3em] text-[#00e5ff] uppercase">Cleanroom Foundry · ISO Class 5</span>
      </div>
      <Glass accent="cyan" glow className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-mono text-[9px] tracking-[0.22em] text-white/30 uppercase mb-1">APX-7 Production Facility</p>
            <h2 className="font-sans font-black text-2xl sm:text-3xl text-white leading-tight">1,200 m²</h2>
            <p className="font-mono text-[10px] text-[#00e5ff]/75 tracking-[0.16em] mt-0.5">Active Cleanroom Floor</p>
          </div>
          <Chip color="#00e5ff">LIVE</Chip>
        </div>
        <p className="font-sans text-[11px] sm:text-xs text-white/60 leading-relaxed mb-4">
          A sealed ISO Class 5 environment where every APX-7 begins as raw titanium billet — zero contamination, zero compromise on structural integrity.
        </p>
        <div className="flex flex-col gap-2.5">
          <SpecRow label="CNC Milling Precision" value="±0.02 mm" pct={100} color="#00e5ff" delay={0} />
          <SpecRow label="Thermal Treatment" value="98% pass" pct={98} color="#00c8e6" delay={0.1} />
          <SpecRow label="QA Inspection" value="99.2%" pct={99} color="#4df0ff" delay={0.2} />
        </div>
      </Glass>
      <div className="grid grid-cols-3 gap-2">
        {[
          {value:"847",    label:"Units / Day",    sub:"peak output"},
          {value:"99.2%",  label:"Uptime SLA",     sub:"12-mo avg"},
          {value:"2.4 min",label:"Cycle Time",     sub:"per unit"},
        ].map(s => (
          <Glass key={s.label} accent="cyan" className="p-3">
            <Stat value={s.value} label={s.label} sub={s.sub} />
          </Glass>
        ))}
      </div>
    </div>
  );
}

function Stage02() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-[430px]">
      <div className="flex items-center gap-2 justify-end">
        <span className="font-mono text-[10px] font-bold tracking-[0.3em] text-[#00e5ff] uppercase">Fabrication Line · Cell 01</span>
        <Dot color="#00e5ff" />
      </div>
      <Glass accent="cyan" glow className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-mono text-[9px] tracking-[0.2em] text-white/30 uppercase mb-1">Assembly Pipeline</p>
            <h2 className="font-sans font-black text-xl sm:text-2xl text-white leading-tight">Build Sequence</h2>
          </div>
          <div className="text-right">
            <p className="font-mono text-[9px] text-white/30 tracking-[0.16em] uppercase">Cycle</p>
            <p className="font-mono font-black text-xl text-[#00e5ff]">2.4 min</p>
          </div>
        </div>
        <div className="flex flex-col gap-0">
          {[
            {step:"01", name:"Frame Forge",      detail:"Ti-6Al-4V billet → CNC spine",     done:true},
            {step:"02", name:"Actuator Fitting",  detail:"42 N·m servo torque precision",     done:true},
            {step:"03", name:"Ceramic Shell",     detail:"2.4 mm aerospace plate layup",      done:true},
            {step:"04", name:"Wiring Loom",       detail:"480-channel flex harness install",  done:false},
          ].map((item,i) => (
            <motion.div key={item.step}
              initial={{opacity:0,x:10}} animate={{opacity:1,x:0}}
              transition={{delay:i*0.08,duration:0.4}}
              className="flex items-center gap-3 py-2 border-b last:border-0 border-white/[0.06]">
              <span className={`font-mono text-[9px] font-bold w-5 flex-shrink-0 ${item.done ? "text-[#00e5ff]" : "text-white/20"}`}>{item.step}</span>
              <div className="flex-1 min-w-0">
                <p className={`font-mono text-[11px] font-bold tracking-[0.1em] ${item.done ? "text-white" : "text-white/35"}`}>{item.name}</p>
                <p className="font-mono text-[9px] text-white/28 truncate mt-0.5">{item.detail}</p>
              </div>
              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${item.done ? "bg-[#00e5ff]" : "bg-white/10"}`}
                style={item.done ? {boxShadow:"0 0 6px #00e5ff"} : {}} />
            </motion.div>
          ))}
        </div>
      </Glass>
      <div className="grid grid-cols-2 gap-2">
        <Glass accent="cyan" className="p-4">
          <p className="font-mono text-[9px] text-white/30 tracking-[0.18em] uppercase mb-2">Articulated Hands</p>
          <Stat value="16 DOF" label="Per Hand" color="#00e5ff" />
          <p className="font-sans text-[10px] text-white/40 mt-2 leading-relaxed">5-finger micro-actuator. Sub-mm grasp.</p>
        </Glass>
        <Glass accent="cyan" className="p-4">
          <p className="font-mono text-[9px] text-white/30 tracking-[0.18em] uppercase mb-2">Shell Press</p>
          <Stat value="420 kN" label="Cold Press" color="#4df0ff" />
          <p className="font-sans text-[10px] text-white/40 mt-2 leading-relaxed">Autoclave-cured. Scratch & heat proof.</p>
        </Glass>
      </div>
    </div>
  );
}

function Stage03() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-[430px]">
      <div className="flex items-center gap-2">
        <Dot color="#8b5cf6" pulse />
        <span className="font-mono text-[10px] font-bold tracking-[0.3em] text-violet-400 uppercase">Synaptic Cortex · 70B Params</span>
      </div>
      <Glass accent="violet" glow className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-mono text-[9px] tracking-[0.2em] text-white/30 uppercase mb-1">Transformer Policy</p>
            <h2 className="font-sans font-black text-3xl sm:text-4xl text-white leading-tight">70B</h2>
            <p className="font-mono text-[10px] text-violet-400/80 tracking-[0.16em] mt-0.5">Parameter Neural Core</p>
          </div>
          <Chip color="#8b5cf6">ACTIVE</Chip>
        </div>
        <p className="font-sans text-[11px] sm:text-xs text-white/58 leading-relaxed mb-4">
          Closed-loop transformer streams 12,000 hours of human motion — learns new tasks from a single demonstration with 4.2 ms reflex latency.
        </p>
        <div className="flex flex-col gap-2.5">
          <SpecRow label="Vision Tokens / sec" value="24k" pct={88} color="#8b5cf6" delay={0} />
          <SpecRow label="Motion Planning" value="4.2 ms" pct={96} color="#a78bfa" delay={0.1} />
          <SpecRow label="Object Recognition" value="99.8%" pct={99} color="#c4b5fd" delay={0.2} />
        </div>
      </Glass>
      <div className="grid grid-cols-2 gap-2">
        <Glass accent="violet" className="p-4">
          <p className="font-mono text-[9px] text-white/30 tracking-[0.18em] uppercase mb-2">Sensorimotor Reflex</p>
          <Stat value="4.2 ms" label="Loop Latency" color="#8b5cf6" sub="240 Hz recompute" />
        </Glass>
        <Glass accent="violet" className="p-4">
          <p className="font-mono text-[9px] text-white/30 tracking-[0.18em] uppercase mb-2">Training Data</p>
          <Stat value="12k hrs" label="Human Motion" color="#a78bfa" sub="live ingestion" />
        </Glass>
      </div>
    </div>
  );
}

function Stage04() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-[430px]">
      <div className="flex items-center gap-2 justify-end">
        <span className="font-mono text-[10px] font-bold tracking-[0.3em] text-amber-400 uppercase">Agility Test Rig · Stress Cycle</span>
        <Dot color="#fbbf24" pulse />
      </div>
      <Glass accent="amber" glow className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-mono text-[9px] tracking-[0.2em] text-white/30 uppercase mb-1">Solid-State Power Bus</p>
            <h2 className="font-sans font-black text-3xl sm:text-4xl text-white leading-tight">48 hrs</h2>
            <p className="font-mono text-[10px] text-amber-400/80 tracking-[0.16em] mt-0.5">Continuous Runtime</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[9px] text-white/30 uppercase tracking-[0.14em]">Inductive Charge</p>
            <p className="font-mono font-black text-xl text-amber-400">15 min</p>
          </div>
        </div>
        <p className="font-sans text-[11px] sm:text-xs text-white/58 leading-relaxed mb-4">
          48.2V high-discharge bus. Wireless inductive fast-charge. Dynamic torque vectoring on every joint for zero-waste energy delivery.
        </p>
        <div className="flex flex-col gap-2.5">
          <SpecRow label="Bus Voltage" value="48.2V" pct={92} color="#fbbf24" delay={0} />
          <SpecRow label="Peak Joint Torque" value="450 N·m" pct={85} color="#fcd34d" delay={0.1} />
          <SpecRow label="QA Stress Cycles" value="100%" pct={100} color="#fde68a" delay={0.2} />
        </div>
      </Glass>
      <div className="grid grid-cols-3 gap-2">
        {[
          {value:"0.6 m",   label:"Vertical Leap",  color:"#fbbf24"},
          {value:"3.2 m/s", label:"Sprint Speed",   color:"#fcd34d"},
          {value:"42 DOF",  label:"Joint Range",    color:"#fde68a"},
        ].map(s => (
          <Glass key={s.label} accent="amber" className="p-3">
            <Stat value={s.value} label={s.label} color={s.color} />
          </Glass>
        ))}
      </div>
    </div>
  );
}

function Stage05Left() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-[430px]">
      <div className="flex items-center gap-2">
        <Dot color="#34d399" pulse />
        <span className="font-mono text-[10px] font-bold tracking-[0.3em] text-emerald-400 uppercase">Production Certified · APX-7</span>
      </div>
      <Glass accent="emerald" glow className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-mono text-[9px] tracking-[0.2em] text-white/30 uppercase mb-1">Final System Spec</p>
            <h2 className="font-sans font-black text-2xl sm:text-3xl text-white leading-tight">1.82 m</h2>
            <p className="font-mono text-[10px] text-emerald-400/80 tracking-[0.16em] mt-0.5">Full Scale · 78 KG Chassis</p>
          </div>
          <Chip color="#34d399">ARMED</Chip>
        </div>
        <p className="font-sans text-[11px] sm:text-xs text-white/58 leading-relaxed mb-3">
          White ceramic over mirror-chrome hydraulic musculature. Force-limited joints for safe co-existence with humans.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            {value:"42 DOF",  label:"Degrees of Freedom", color:"#34d399"},
            {value:"78 kg",   label:"Chassis Mass",       color:"#6ee7b7"},
            {value:"1.82 m",  label:"Standing Height",    color:"#a7f3d0"},
            {value:"360°",    label:"Shoulder Reach",     color:"#34d399"},
          ].map(s => (
            <Glass key={s.label} accent="emerald" className="p-3">
              <Stat value={s.value} label={s.label} color={s.color} />
            </Glass>
          ))}
        </div>
      </Glass>
    </div>
  );
}

function Stage05Right() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-[430px]">
      <div className="flex items-center gap-2 justify-end">
        <span className="font-mono text-[10px] font-bold tracking-[0.3em] text-emerald-400 uppercase">System Armed · Deploy Ready</span>
        <Dot color="#34d399" pulse />
      </div>
      <Glass accent="emerald" glow className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[9px] tracking-[0.2em] text-white/30 uppercase">Telemetry Status</p>
          <Chip color="#34d399">● ONLINE</Chip>
        </div>
        <p className="font-mono font-black text-2xl sm:text-3xl text-emerald-400 mb-3"
          style={{textShadow:"0 0 30px rgba(52,211,153,0.5)"}}>ARMED · 100%</p>
        <p className="font-sans text-[11px] sm:text-xs text-white/58 leading-relaxed mb-4">
          Full system lock complete. Autonomous navigation, dual-arm manipulation, and repulsor array initialized.
        </p>
        <div className="flex flex-col gap-2.5">
          <SpecRow label="Autonomous Navigation" value="ONLINE" pct={100} color="#34d399" delay={0} />
          <SpecRow label="Dual-Arm Control" value="ARMED" pct={100} color="#6ee7b7" delay={0.1} />
          <SpecRow label="Repulsor Array" value="PRIMED" pct={100} color="#a7f3d0" delay={0.2} />
          <SpecRow label="Safety Envelope" value="LOCKED" pct={100} color="#34d399" delay={0.3} />
        </div>
      </Glass>
    </div>
  );
}

/* ── Animation wrapper ──────────────────────────────────────────────────────── */
const panelV = {
  hidden: (d: number) => ({ opacity: 0, x: d * 50, filter: "blur(10px)" }),
  show:   { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: [0.22,1,0.36,1] as const } },
  exit:   (d: number) => ({ opacity: 0, x: d * 36, filter: "blur(8px)", transition: { duration: 0.32 } }),
};

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN EXPORT
   ══════════════════════════════════════════════════════════════════════════════ */
export const HomepageHero = memo(function HomepageHero({ pHero, pHeroRef, onEnterManufacturing }: HomepageHeroProps) {
  const [interactiveOrbit, setInteractiveOrbit] = useState(false);
  const [tickerTime, setTickerTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTickerTime(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const activeStep = useMemo(() => {
    if (pHero < 0.20) return 1;
    if (pHero < 0.40) return 2;
    if (pHero < 0.60) return 3;
    if (pHero < 0.80) return 4;
    return 5;
  }, [pHero]);

  const showCards = pHero > 0.04;

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden bg-[#020508] text-white select-none flex flex-col">

      {/* Ambient gradients */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_30%,rgba(0,229,255,0.055),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,rgba(120,80,255,0.04),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(0,229,255,0.03),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.018]"
        style={{backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.5) 3px,rgba(255,255,255,0.5) 4px)"}} />

      {/* HEADER */}
      <header className="relative z-30 flex items-center justify-between px-6 pt-6 sm:px-12 pointer-events-auto flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#00e5ff]" style={{boxShadow:"0 0 10px rgba(0,229,255,0.9)"}} />
            <span className="font-mono text-base font-bold tracking-[0.28em] text-white">APEX</span>
          </div>
          <span className="hidden sm:block h-3 w-px bg-white/20" />
          <span className="hidden sm:block font-mono text-xs tracking-[0.2em] text-white/50">ROBOTICS &bull; 2026</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setInteractiveOrbit(p => !p)}
            className={`flex items-center gap-2 rounded-full border px-2 sm:px-4 py-1.5 font-mono text-[9px] sm:text-xs tracking-[0.16em] transition-all cursor-pointer ${interactiveOrbit ? "border-[#00e5ff] bg-[#00e5ff]/15 text-[#00e5ff] shadow-[0_0_20px_rgba(0,229,255,0.4)]" : "border-white/10 bg-white/5 text-white/60 hover:text-white hover:border-white/25"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${interactiveOrbit ? "bg-[#00e5ff] animate-ping" : "bg-white/40"}`} />
            {interactiveOrbit ? "360° ACTIVE" : "360° VIEW"}
          </button>
          <button onClick={onEnterManufacturing}
            className="group flex items-center gap-2 rounded-full border border-[#00e5ff]/40 bg-[#00e5ff]/10 px-2 sm:px-5 py-2 font-mono text-[9px] sm:text-xs font-bold tracking-[0.2em] text-[#00e5ff] shadow-[0_0_20px_rgba(0,229,255,0.2)] transition-all hover:bg-[#00e5ff] hover:text-[#020508] hover:shadow-[0_0_40px_rgba(0,229,255,0.7)] cursor-pointer">
            <span>HOW IT WORKS</span>
            <span className="transition-transform duration-300 group-hover:translate-y-0.5">↓</span>
          </button>
        </div>
      </header>

      {/* BACKGROUND TITLE */}
      <div className="pointer-events-none absolute inset-x-0 top-[8vh] z-0 flex flex-col items-center text-center">
        <motion.div
          animate={{scale: activeStep===2 ? 0.94 : activeStep===3 ? 0.93 : activeStep===5 ? 1.05 : 1.0, y: activeStep===3 ? -8 : activeStep===5 ? 6 : 0}}
          transition={{duration:0.8, ease:[0.22,1,0.36,1]}}
          className="flex flex-col items-center">
          <h1 className="font-sans font-black leading-[0.82] tracking-tighter uppercase select-none"
            style={{fontSize:"clamp(80px,17vw,220px)",background:"linear-gradient(180deg,rgba(255,255,255,0.92) 0%,rgba(255,255,255,0.5) 60%,rgba(0,229,255,0.06) 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",filter:"drop-shadow(0 20px 60px rgba(0,0,0,0.9))"}}>
            APEX ROBOTICS
          </h1>
          <AnimatePresence mode="wait">
            {showCards ? (
              <motion.span key={activeStep} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:0.5}}
                className="font-mono text-xs sm:text-sm tracking-[0.45em] uppercase text-white/50 mt-3 font-semibold">
                {STEPS[activeStep-1].subtitle}
              </motion.span>
            ) : (
              <motion.span key="intro" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.6,delay:0.4}}
                className="font-mono text-xs sm:text-sm tracking-[0.45em] uppercase text-white/40 mt-3 font-semibold">
                INTELLIGENCE BUILT &bull; SCROLL TO EXPLORE
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* 3D CANVAS */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <HumanoidCanvas progress={pHeroRef} interactiveOrbit={interactiveOrbit} />
      </div>

      {/* CONTENT PANELS */}
      <div className="relative z-20 flex-1 flex items-center pointer-events-none">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-0 px-3 sm:px-6 lg:px-10">

          {/* LEFT — steps 1, 3, 5 */}
          <div className="lg:col-span-5 flex flex-col justify-center py-4 pointer-events-auto">
            <AnimatePresence mode="wait">
              {showCards && activeStep===1 && (
                <motion.div key="L1" custom={-1} variants={panelV} initial="hidden" animate="show" exit="exit"><Stage01 /></motion.div>
              )}
              {showCards && activeStep===3 && (
                <motion.div key="L3" custom={-1} variants={panelV} initial="hidden" animate="show" exit="exit"><Stage03 /></motion.div>
              )}
              {showCards && activeStep===5 && (
                <motion.div key="L5" custom={-1} variants={panelV} initial="hidden" animate="show" exit="exit"><Stage05Left /></motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* MIDDLE — stage rail */}
          <div className="hidden lg:flex lg:col-span-2 flex-col items-center justify-center">
            {showCards && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.7}}>
                <StageRail active={activeStep} />
              </motion.div>
            )}
          </div>

          {/* RIGHT — steps 2, 4, 5 */}
          <div className="lg:col-span-5 flex flex-col justify-center py-4 pointer-events-auto items-end">
            <AnimatePresence mode="wait">
              {showCards && activeStep===2 && (
                <motion.div key="R2" custom={1} variants={panelV} initial="hidden" animate="show" exit="exit"><Stage02 /></motion.div>
              )}
              {showCards && activeStep===4 && (
                <motion.div key="R4" custom={1} variants={panelV} initial="hidden" animate="show" exit="exit"><Stage04 /></motion.div>
              )}
              {showCards && activeStep===5 && (
                <motion.div key="R5" custom={1} variants={panelV} initial="hidden" animate="show" exit="exit"><Stage05Right /></motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* BOTTOM HUD */}
      <footer className="relative z-30 px-6 sm:px-12 pb-5 pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-3 font-mono text-xs text-white/50 tracking-[0.2em]">
          <Dot color="#00e5ff" pulse={false} />
          <span className="text-[#00e5ff]/80 font-bold">SYSTEM: ONLINE</span>
          <span className="hidden sm:inline text-white/20">·</span>
          <span className="hidden sm:inline text-white/35">APX-7 REV 4.2.1</span>
        </div>
        <div className="flex items-center gap-6 font-mono text-[10px] text-white/40 tracking-[0.2em]">
          <AnimatePresence mode="wait">
            <motion.span key={activeStep} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0}} className="text-white/60 font-bold">
              STAGE {String(activeStep).padStart(2,"0")}/05
            </motion.span>
          </AnimatePresence>
          <span>LOCAL {tickerTime}</span>
        </div>
      </footer>

    </div>
  );
});
