"use client";

import { motion } from "framer-motion";

type Register = (id: string) => (el: HTMLElement | null) => void;

function LED({ tone = "signal", pulse = false }: { tone?: string; pulse?: boolean }) {
  return (
    <span
      className={`relative inline-block h-1.5 w-1.5 rounded-full mr-2 ${pulse ? "hud-blink" : ""}`}
      style={{
        backgroundColor: `var(--${tone})`,
        boxShadow: `0 0 10px color-mix(in srgb, var(--${tone}) 80%, transparent)`,
      }}
    />
  );
}

function HudBadge({ children, tone = "signal" }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 backdrop-blur-md"
      style={{
        borderColor: `color-mix(in srgb, var(--${tone}) 22%, transparent)`,
        background: `color-mix(in srgb, var(--${tone}) 5%, rgba(11,17,25,0.7))`,
      }}
    >
      <LED tone={tone} pulse />
      <span className="hud-label" style={{ color: `var(--${tone})`, opacity: 0.85 }}>{children}</span>
    </span>
  );
}

function StatCard({ label, value, unit, tone = "signal", delay = 0 }: {
  label: string; value: string; unit?: string; tone?: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="glass rounded-xl px-4 py-3 flex flex-col gap-1"
    >
      <span className="hud-label text-mute">{label}</span>
      <span className="font-mono text-xl font-bold tracking-tight" style={{ color: `var(--${tone})`, textShadow: `0 0 20px color-mix(in srgb, var(--${tone}) 50%, transparent)` }}>
        {value}<span className="text-sm font-normal ml-1 opacity-60">{unit}</span>
      </span>
    </motion.div>
  );
}

function SpecRow({ label, value, delay = 0 }: { label: string; value: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="flex items-center justify-between border-b border-linesoft pb-2"
    >
      <span className="hud-label text-mute/70">{label}</span>
      <span className="font-mono text-[11px] tracking-widest text-ink/80">{value}</span>
    </motion.div>
  );
}

export function Sections({ register }: { register: Register }) {
  return (
    <>
      {/* ============ 01 — FACTORY OVERVIEW ============ */}
      <section ref={register("s-intro")} className="pointer-events-none fixed inset-0 z-10 flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          ref={register("s-intro-sub")}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-7 flex flex-col items-center gap-4"
        >
          <span className="float-y flex items-center gap-1 rounded-full border border-signal/20 bg-panel/50 px-4 py-2 backdrop-blur-md" style={{ boxShadow: "0 0 0 1px rgba(0,229,255,0.05), 0 0 30px rgba(0,229,255,0.08)" }}>
            <LED tone="signal" pulse />
            <span className="hud-label text-signal/80">APEX ROBOTICS || FACTORY OVERVIEW</span>
          </span>
          <div className="flex gap-2 flex-wrap justify-center">
            <HudBadge tone="pass">847 UNITS / DAY</HudBadge>
            <HudBadge tone="signal">99.2% UPTIME</HudBadge>
            <HudBadge tone="warn">LIVE PRODUCTION</HudBadge>
          </div>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.7 }}
          className="mt-6 max-w-md text-[13px] leading-relaxed tracking-wide text-dim sm:max-w-[620px] sm:text-sm"
          style={{ textShadow: "0 1px 24px rgba(0,229,255,0.12)" }}
        >
          Step inside the bio-synthetic foundry. A 1,200m² floor where alloy is formed, actuators torqued, and APX-7 comes to life — follow the scroll journey.
        </motion.p>

        {/* live factory stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.7 }} className="mt-8 grid w-full max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="UNITS ASSEMBLED" value="847" unit="total" tone="signal" delay={0.9} />
          <StatCard label="SYSTEM UPTIME" value="99.2" unit="%" tone="pass" delay={0.95} />
          <StatCard label="NEURAL ACCURACY" value="99.8" unit="%" tone="violet" delay={1.0} />
          <StatCard label="QA CLEARANCE" value="98.7" unit="%" tone="warn" delay={1.05} />
        </motion.div>

        {/* mini factory floor cells */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }} className="mt-5 hidden w-full max-w-2xl grid-cols-3 gap-2 sm:grid">
          {[
            ["CELL 01", "ASSEMBLY", "12 units", "pass"],
            ["CELL 02", "TRAINING", "8 nodes", "signal"],
            ["CELL 03", "QA BAY", "4 rigs", "warn"],
          ].map(([a, b, c, tone]) => (
            <div key={a} className="glass rounded-md px-3 py-2 text-left">
              <div className="hud-label" style={{ color: `var(--${tone})`, opacity: 0.7 }}>{a}</div>
              <div className="font-mono text-[11px] tracking-[0.16em] text-ink">{b}</div>
              <div className="hud-label text-mute flex items-center gap-1"><span className="h-1 w-1 rounded-full hud-blink" style={{ backgroundColor: `var(--${tone})` }} />{c}</div>
            </div>
          ))}
        </motion.div>

        <div ref={register("s-scroll-hint")} className="absolute bottom-[5vh] flex flex-col items-center gap-3">
          <span className="hud-label text-mute">Scroll to enter</span>
          <span className="relative block h-10 w-px overflow-hidden bg-line"><span className="absolute left-0 top-0 h-3 w-px animate-[scrolldrop_1.4s_ease-in-out_infinite] bg-signal" /></span>
        </div>
        <style>{`@keyframes scrolldrop{0%{transform:translateY(-12px)}60%{transform:translateY(40px)}100%{transform:translateY(40px)}}`}</style>
      </section>

      {/* ============ 02 — ROBOT ASSEMBLY ============ */}
      <section className="pointer-events-none fixed inset-0 z-10">
        <div ref={register("s-assembly-title")} className="absolute left-6 top-[12vh] sm:left-[6vw]">
          <HudBadge tone="warn">ROBOT ASSEMBLY || CELL 01</HudBadge>
          <h2 className="heading-tech mt-3 text-3xl text-ink sm:text-4xl">FROM METAL<br /><span className="gradient-text">TO MOTION</span></h2>
          <p className="mt-3 hidden max-w-[260px] font-mono text-[10px] leading-relaxed tracking-[0.14em] text-mute sm:block">
            Every unit: legs → torso → <b className="text-ink/80">hands & screws</b> → head/visor → core. Watch the APX-7 assemble in real-time.
          </p>
          <div className="mt-4 hidden items-center gap-2 sm:flex">
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} className="grid h-7 w-7 place-items-center rounded-full border border-line bg-panel/60">⟳</motion.span>
            <span className="hud-label text-mute">SCREW TORQUE 42 N·M — FITTING HANDS</span>
          </div>
        </div>

        {/* assembly stage cards */}
        <div ref={register("s-assembly")} className="absolute right-8 top-[68%] flex w-[210px] -translate-y-1/2 flex-col gap-2 sm:w-[286px]">
          <div className="glass flex items-center justify-between rounded-lg px-3 py-2">
            <span className="hud-label text-mute">BUILD STAGES</span><span className="hud-chip rounded px-2 py-0.5 font-mono text-[10px] tracking-widest text-signal">04/04</span>
          </div>
          {[
            ["frame", "01", "METAL FORMING"],
            ["actuators", "02", "SCREW FITTING — HANDS"],
            ["sensor", "03", "PRECISION WELDING"],
            ["compute", "04", "LIVE TESTING"],
          ].map(([id, num, name], i) => (
            <motion.div
              key={id}
              ref={register(`chip-${id}`)}
              initial={{ opacity: 0, x: 12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="hud-chip glass-strong flex items-center gap-3 rounded-md px-3 py-2.5"
            >
              <span className="w-6 font-mono text-[10px] tracking-widest text-signal">{num}</span>
              <span className="h-1.5 w-px bg-line" />
              <span className="flex-1 font-mono text-[11px] tracking-[0.18em] text-ink/85">{name}</span>
              <span ref={register(`chip-${id}-st`)} data-state="" className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-[0.18em] text-mute"><span className="h-1 w-1 rounded-full bg-current" />SEQUENCED</span>
            </motion.div>
          ))}

          {/* live process metrics */}
          <div className="glass rounded-lg px-3 py-2 mt-1">
            <div className="hud-label text-mute mb-2">PROCESS METRICS</div>
            {[["ALLOY GRADE", "2.4mm Ti-Al"], ["WELD CURRENT", "420A"], ["TORQUE", "42 N·M"], ["CYCLE TIME", "2.4 min"]].map(([k, v]) => (
              <div key={k} className="flex justify-between items-center border-b border-linesoft py-1 last:border-0">
                <span className="hud-label text-mute/70">{k}</span>
                <span className="font-mono text-[10px] text-signal/80">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="corner-bracket absolute bottom-[9vh] left-6 h-14 w-24 sm:left-[6vw]" />
        <span className="absolute bottom-[4vh] left-6 font-mono text-[9px] tracking-[0.22em] text-mute sm:left-[6vw]">ALLOY 2.4 mm · TORQUE 42 N·M · SEAM 420A · QA LIVE</span>
      </section>

      {/* ============ 03 — AI BRAIN — ROBOT LEARNING ============ */}
      <section ref={register("s-ai")} className="pointer-events-none fixed inset-0 z-10">
        <div className="absolute left-6 top-[36vh] w-[210px] sm:left-[6vw] sm:w-[300px]">
          <div className="glass rounded-lg px-4 py-4">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal/60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-signal" /></span>
              <span className="hud-label text-signal/80">AI BRAIN || APX-7 LEARNING</span>
            </div>
            <div ref={register("ai-status")} className="mb-3 font-mono text-[13px] tracking-[0.24em] text-pass" data-on="">● AI CORE OFFLINE</div>
            <p className="mb-4 font-mono text-[10px] leading-relaxed tracking-[0.14em] text-mute">Robot watches 12k hrs of human motion — vision, spatial, motion planning stream to visor scan.</p>
            <div className="flex flex-col gap-3">
              {AI_MODULES.map((m) => (
                <div key={m.id}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-ink/75">{m.label}</span>
                    <span ref={register(`${m.id}-v`)} className="font-mono text-[10px] tracking-widest text-signal">00.0%</span>
                  </div>
                  <div className="h-[3px] w-full overflow-hidden rounded-full bg-line"><div ref={register(m.id)} className="h-full w-full rounded-full bg-gradient-to-r from-signal/40 to-signal" style={{ boxShadow: "0 0 12px rgba(0,229,255,0.5)" }} /></div>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-linesoft pt-3">
              <div className="mb-1.5 flex items-center justify-between"><span className="font-mono text-[10px] tracking-[0.2em] text-ink/75">NEURAL NETWORK SYNAPSES</span><span ref={register("nn-pct")} className="font-mono text-[10px] tracking-widest text-pass">0%</span></div>
              <div className="h-[3px] w-full overflow-hidden rounded-full bg-line"><div ref={register("nn-fill")} className="h-full w-full rounded-full bg-gradient-to-r from-pass/30 to-pass" /></div>
            </div>
          </div>

          {/* brain visual */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="mt-3 glass flex items-center gap-3 rounded-md px-3 py-2">
            <svg width={36} height={36} viewBox="0 0 36 36" className="shrink-0"><path d="M12 10a6 6 0 0 1 12 0c2 0 4 1.5 4 4a4 4 0 0 1-4 4c0 2.5-2 4.5-6 4.5S12 20.5 12 18a4 4 0 0 1-4-4c0-2.5 2-4 4-4Z" fill="none" stroke="var(--signal)" strokeWidth={1.1} opacity={0.9} /><circle cx={14} cy={16} r={1.2} fill="var(--signal)"><animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite" /></circle><circle cx={22} cy={16} r={1.2} fill="var(--pass)"><animate attributeName="opacity" values="0.2;1;0.2" dur="1.2s" repeatCount="indefinite" /></circle></svg>
            <div><div className="hud-label text-ink/80">BRAIN ACTIVE</div><div className="font-mono text-[9px] tracking-[0.16em] text-mute">12,000 hrs → visor scan 60Hz</div></div>
          </motion.div>
        </div>

        {/* right side: AI capability spectrum */}
        <div className="absolute right-8 top-[45vh] hidden w-[240px] flex-col gap-2 sm:flex sm:w-[280px]">
          <div className="glass rounded-lg px-4 py-3">
            <div className="hud-label text-signal/70 mb-3">APX-7 CAPABILITIES</div>
            {[
              { label: "NATURAL LANGUAGE", pct: 94, tone: "signal" },
              { label: "COMPUTER VISION", pct: 99, tone: "pass" },
              { label: "MOTOR CONTROL", pct: 97, tone: "violet" },
              { label: "SOCIAL COGNITION", pct: 88, tone: "warn" },
              { label: "SELF-DIAGNOSIS", pct: 95, tone: "signal" },
            ].map(({ label, pct, tone }) => (
              <div key={label} className="mb-2">
                <div className="flex justify-between mb-0.5">
                  <span className="hud-label text-mute/70">{label}</span>
                  <span className="font-mono text-[9px]" style={{ color: `var(--${tone})` }}>{pct}%</span>
                </div>
                <div className="h-[2px] w-full bg-line rounded-full overflow-hidden">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: pct / 100 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full origin-left"
                    style={{ background: `linear-gradient(90deg, color-mix(in srgb, var(--${tone}) 40%, transparent), var(--${tone}))` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {/* neural data stream */}
          <div className="glass rounded-lg px-4 py-3 font-mono text-[9px] tracking-[0.12em] text-mute space-y-1">
            <div className="hud-label text-signal/60 mb-2">NEURAL DATA STREAM</div>
            {["0x4AF2 → CORTEX [VISION]", "0x3BD1 → MOTOR [ARM_L]", "0xA11C → MEMORY [CACHE]", "0x7E90 → SENSOR [LIDAR]", "0x2F55 → PREDICT [PATH]"].map((line, i) => (
              <motion.div key={line} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.8, delay: i * 0.36, repeat: Infinity }}
                className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-signal/60" />
                {line}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-[9vh] right-36 hidden text-right sm:right-44 sm:block">
          <span className="hud-label text-signal/50">SIGNAL INTEGRITY</span>
          <div className="mt-2 flex items-center justify-end gap-2 font-mono text-[10px] tracking-widest text-mute"><span className="text-pass">LINKED</span><span className="h-1.5 w-1.5 rounded-full bg-pass hud-blink" /></div>
        </div>
      </section>

      {/* ============ 04 — TRAINING / DIGITAL TWIN ============ */}
      <section ref={register("s-training")} className="pointer-events-none fixed inset-0 z-10">
        <div ref={register("twin-d")} className="absolute left-1/2 top-[10vh] -translate-x-1/2 text-center">
          <span className="mt-3 hud-label inline-flex items-center gap-2 rounded-full border border-violet/25 bg-panel/60 px-4 py-1.5 text-signal/80 backdrop-blur-md">
            <LED tone="violet" pulse />TWIN LINK || ACTIVE — LEARNING LOOP</span>
        </div>
        <div ref={register("twin-l")} className="absolute left-6 top-[22vh] sm:left-[8vw]"><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-pass" /><span className="hud-label text-ink/70">PHYSICAL WORLD</span></span><p className="mt-2 max-w-[190px] font-mono text-[10px] leading-relaxed tracking-wider text-mute">ROBOT → CAMERA → SENSOR → MOVEMENT — 4ms latency</p>
          {/* physical world metrics */}
          <div className="mt-3 glass rounded-lg px-3 py-2 w-[180px]">
            {[["SENSOR RATE", "1kHz"], ["LATENCY", "4ms"], ["CAMERAS", "12x"], ["LIDAR", "360°"]].map(([k, v]) => (
              <div key={k} className="flex justify-between py-0.5 border-b border-linesoft last:border-0">
                <span className="hud-label text-mute/60">{k}</span>
                <span className="font-mono text-[9px] text-pass">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div ref={register("twin-r")} className="absolute right-12 top-[45vh] text-right">
          <div className="flex items-center justify-end gap-2"><span className="hud-label text-signal/80">DIGITAL SIMULATION</span><span className="h-1.5 w-1.5 rounded-full bg-signal hud-blink" /></div>
          <p className="mt-2 max-w-[190px] font-mono text-[10px] leading-relaxed tracking-wider text-mute">SIM → AI MODEL → PREDICTION → OPTIMIZATION</p>
          {/* sim metrics */}
          <div className="mt-3 glass rounded-lg px-3 py-2 w-[180px] ml-auto text-left">
            {[["SIM SPEED", "100× RT"], ["EPISODES", "1M+"], ["GPU CLUSTER", "512 A100"], ["MODEL SIZE", "70B"]].map(([k, v]) => (
              <div key={k} className="flex justify-between py-0.5 border-b border-linesoft last:border-0">
                <span className="hud-label text-mute/60">{k}</span>
                <span className="font-mono text-[9px] text-signal">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-[18vh] left-6 w-[250px] sm:left-[8vw] sm:w-[290px]">
          <span className="hud-label text-mute">SIMULATION TASKS — FRAMER DRIVEN</span>
          <div className="mt-3 flex flex-col gap-2">
            {["OBJ_RECOGNITION.EXE", "PATH_PLAN.EXE", "PICK_PLACE.EXE", "HUMAN_DETECT.EXE", "BALANCE_FIX.EXE"].map((t, i) => (
              <motion.div key={t} ref={register(`task-${i + 1}`)} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between rounded-md border border-linesoft bg-panel/50 px-3 py-1.5 backdrop-blur-sm">
                <span className="font-mono text-[10px] tracking-[0.16em] text-ink/75">{t}</span><span data-role="run" className="font-mono text-[9px] tracking-widest text-signal">RUN</span>
              </motion.div>
            ))}
          </div>
        </div>
        <div ref={register("twin-link")} className="twin-link absolute left-1/2 top-[48%] hidden w-[42vw] -translate-x-1/2 sm:block"><span className="twin-link__line" /><span className="twin-link__pulse" /><span className="twin-link__label hud-label">LATENCY 04 MS</span></div>
      </section>

      {/* ============ 05 — TESTING CHAMBER ============ */}
      <section ref={register("s-testing")} className="pointer-events-none fixed inset-0 z-10">
        <div className="absolute left-6 top-[12vh] sm:left-[7vw]">
          <HudBadge tone="warn">QUALITY ASSURANCE || CELL 03</HudBadge>
          <p className="mt-2 max-w-[240px] font-mono text-[10px] leading-relaxed tracking-[0.14em] text-mute">Mobility, balance, vision, reaction — robot is shaken, scanned, and graded.</p>
        </div>

        <div className="absolute right-8 top-[61vh] flex w-[210px] -translate-y-1/2 flex-col gap-1.5 sm:w-[300px]">
          {["MOBILITY", "BALANCE", "VISION", "REACTION", "LOAD", "PRECISION", "OBSTACLE AVOID", "AI RESPONSE"].map((label, i) => (
            <motion.div key={label} ref={register(`t-${i + 1}`)} initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between rounded-md border border-linesoft bg-panel/50 px-3 py-1.5 backdrop-blur-sm">
              <span className="font-mono text-[10px] tracking-[0.18em] text-ink/75">{label}</span><span ref={register(`t-${i + 1}-st`)} className="font-mono text-[9px] tracking-[0.2em] text-mute">----</span>
            </motion.div>
          ))}
        </div>

        <div className="absolute bottom-[20vh] left-6 w-[280px] sm:left-[8vw]">
          <div className="glass rounded-lg px-4 py-3">
            <div className="flex items-center justify-between"><span className="hud-label text-mute">SYSTEM DIAGNOSTICS</span><span className="font-mono text-[10px] tracking-widest text-warn">{`>_`}</span></div>
            <div className="mt-2 h-[4px] w-full overflow-hidden rounded-full bg-line"><div ref={register("diag-bar")} className="shimmer-line h-full w-full rounded-full bg-gradient-to-r from-warn/50 to-pass" /></div>
            <div className="mt-3 flex flex-col gap-1 font-mono text-[10px] tracking-[0.14em] text-mute"><span ref={register("diag-1")}>&gt; initializing vision…</span><span ref={register("diag-2")}>&gt; checking actuator response…</span><span ref={register("diag-3")}>&gt; simulating obstacle…</span><span ref={register("diag-4")}>&gt; evaluating response…</span></div>
          </div>
        </div>
        {/* 100% — premium animated badge, now at right corner */}
        <div ref={register("pct-100")} className="absolute left-1/2 -translate-x-1/2 top-[2vh] sm:right-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="glass rounded-2xl px-5 py-4 flex flex-col items-center gap-2 min-w-[124px]"          >
            <div className="relative grid place-items-center h-[72px] w-[72px]">
              <svg width={72} height={72} viewBox="0 0 72 72" className="-rotate-90">
                <circle cx={36} cy={36} r={30} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
                <motion.circle
                  cx={36} cy={36} r={30} fill="none" stroke="var(--pass)" strokeWidth={5} strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 30}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 30 }}
                  whileInView={{ strokeDashoffset: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
                />
              </svg>
              <motion.span
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute font-mono text-[22px] font-bold tracking-tighter text-pass"
              >
                100%
              </motion.span>
            </div>
            <div className="flex flex-col items-center leading-none">
              <span className="hud-label text-pass/80 tracking-[0.22em]">QA PASSED</span>
              <span className="font-mono text-[9px] tracking-[0.16em] text-mute/60">ALL TESTS • VERIFIED</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-pass hud-blink" />
              <span className="hud-label text-mute/60">CERTIFIED</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============ 06 — ACTIVATION — FINISHED ROBOT ============ */}
      <section ref={register("s-activation")} className="pointer-events-none fixed inset-0 top-20 z-10 flex flex-col items-start justify-start px-8 pt-[12vh] max-w-[48vw]">
        <div ref={register("act-lights")} className="mb-4 flex items-center gap-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.span key={i} animate={{ y: [0, -6, 0] }} transition={{ duration: 4.2 + i * 0.4, repeat: Infinity }} className="block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: i === 4 ? "#4dffb0" : "#00e5ff", boxShadow: `0 0 14px ${i === 4 ? "rgba(77,255,176,0.95)" : "rgba(0,229,255,0.9)"}`, animationDelay: `${i * 0.16}s` }} />
          ))}
        </div>

        <motion.h2
          ref={register("act-title")}
          className="heading-tech text-[4vw] gradient-text text-left"
        >BUILT TO THINK</motion.h2>

        <p ref={register("act-sub")} className="mt-4 font-mono text-[11px] leading-relaxed tracking-[0.16em] text-dim sm:text-xs text-left">DESIGNED FOR THE PHYSICAL WORLD.<br />POWERED BY ARTIFICIAL INTELLIGENCE.</p>

        {/* final spec grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="mt-6 grid grid-cols-2 gap-2 w-1/2"
        >
          {[
            { label: "HEIGHT", value: "1.82", unit: "m", tone: "signal" },
            { label: "TORQUE", value: "42", unit: "N·m", tone: "pass" },
            { label: "BATTERY", value: "48", unit: "hrs", tone: "violet" },
            { label: "PAYLOAD", value: "25", unit: "kg", tone: "warn" },
          ].map(({ label, value, unit, tone }, i) => (
            <div key={label} className="glass rounded-xl p-3 flex flex-col gap-1">
              <span className="hud-label text-mute">{label}</span>
              <span className="font-mono text-xl font-bold" style={{ color: `var(--${tone})`, textShadow: `0 0 20px color-mix(in srgb, var(--${tone}) 50%, transparent)` }}>
                {value}<span className="text-sm font-normal ml-1 opacity-60">{unit}</span>
              </span>
            </div>
          ))}
        </motion.div>

        <div ref={register("act-buttons")} className="pointer-events-auto mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" data-act="explore" className="btn-core group relative cursor-pointer rounded-md border border-signal/50 bg-signal/5 px-8 py-3.5 font-mono text-[11px] tracking-[0.26em] text-signal"><span className="relative z-10 flex items-center gap-2">EXPLORE THE ROBOT<span className="transition-transform duration-300 group-hover:translate-x-1">→</span></span></button>
        </div>
      </section>
    </>
  );
}

const AI_MODULES = [
  { id: "bar-vision", label: "VISION", v: "bar-vision-v" },
  { id: "bar-spatial", label: "SPATIAL REASONING", v: "bar-spatial-v" },
  { id: "bar-motion", label: "MOTION PLANNING", v: "bar-motion-v" },
  { id: "bar-detect", label: "OBJECT DETECTION", v: "bar-detect-v" },
];
