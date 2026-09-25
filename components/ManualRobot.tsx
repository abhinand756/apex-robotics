"use client";

import { motion } from "framer-motion";
import { MANUAL_STAGES, ROBOT_GEOMETRY as G } from "@/lib/robot-manual-config";
import { clamp01, easeInOutCubic } from "@/lib/animate";
import { T } from "@/lib/timeline";

function stageProgress(p: number, from: number, to: number) {
  return easeInOutCubic(clamp01((p - from) / (to - from)));
}
function boltProgress(progress: number) {
  return clamp01((progress - 0.38) / 0.34);
}

function Screw({ x, y, r = 0.7, rot, active }: { x: number; y: number; r?: number; rot: number; active?: boolean }) {
  return (
    <g transform={`rotate(${rot} ${x} ${y})`}>
      <circle cx={x} cy={y} r={r} fill="#6d8598" stroke="#0a0f16" strokeWidth={0.18} />
      <line x1={x - r * 0.6} y1={y} x2={x + r * 0.6} y2={y} stroke={active ? "#7fd9ff" : "#cde1eb"} strokeWidth={0.22} strokeLinecap="round" />
      <line x1={x} y1={y - r * 0.6} x2={x} y2={y + r * 0.6} stroke={active ? "#7fd9ff" : "#cde1eb"} strokeWidth={0.12} opacity={0.5} />
    </g>
  );
}

// Bigger, modern attractive robot — animated limbs, improved head, chest power core, full screw connections
export function ManualRobot({ p, ms }: { p: number; ms: number }) {
  const vis = Object.fromEntries(MANUAL_STAGES.map((s) => [s.id, stageProgress(p, s.from, s.to)])) as Record<string, number>;
  const bolt = Object.fromEntries(MANUAL_STAGES.map((s) => [s.id, boltProgress(stageProgress(p, s.from, s.to))])) as Record<string, number>;

  const t = ms * 0.001;
  const breath = Math.sin(t * 1.1) * 0.35;
  const bob = Math.cos(t * 0.9) * 0.45 * (vis.torso > 0.8 ? 1 : 0);

  // head: more complex — pan + tilt + nod
  const headPan = Math.sin(t * 0.62) * 2.2 + Math.sin(t * 0.31) * 0.8;
  const headTilt = Math.sin(t * 0.52) * 2.5 + Math.cos(t * 0.85) * 1.2;
  const headNod = Math.sin(t * 0.45) * 0.6;
  const blink = Math.pow(Math.max(0, Math.sin(t * 1.35)), 22);

  // post-fitting limb animations (after arms/legs fitted)
  const fitted = p > 0.41;
  const walkPhase = t * 1.05;
  const legSwing = fitted ? Math.sin(walkPhase) * 2.2 : 0;
  const armSwing = fitted ? Math.sin(walkPhase + Math.PI) * 6 : 0;
  const kneeBend = fitted ? Math.max(0, Math.sin(walkPhase)) * 3 : 0;

  const alpha = clamp01((p - 0.14) / 0.03);
  const actT = clamp01((p - T.activation[0]) / (T.activation[1] - T.activation[0]));
  const baseScale = 0.96 + 0.1 * clamp01((p - 0.14) / 0.1);
  const finishScale = 1 + actT * 0.55; // bigger final
  const scale = baseScale * finishScale;
  const testDim = 1 - clamp01((p - T.testing[0]) / (T.testing[1] - T.testing[0])) * 0.06;

  const aiGate = clamp01((p - T.ai[0]) / (T.ai[1] - T.ai[0]));

  const legOff = (1 - vis.legs) * 20;
  const torsoOff = (1 - vis.torso) * 16;
  const armOff = (1 - vis.arms) * 24;
  const headOff = (1 - vis.head) * 14;

  return (
    <div className="pointer-events-none fixed inset-0 z-[1] flex items-center justify-center" style={{ opacity: alpha }} aria-hidden>
      {/* larger shadow for bigger robot */}
      <div className="absolute bottom-[15%] left-1/2 h-[16px] w-[300px] -translate-x-1/2 rounded-full bg-black/45 blur-[7px]" />

      {aiGate > 0.02 && aiGate < 0.98 && (
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 480 + aiGate * 80,
            height: 480 + aiGate * 80,
            background: "radial-gradient(circle, rgba(38,90,140,0.10) 0%, rgba(0,229,255,0.05) 35%, transparent 70%)",
            filter: "blur(14px)",
          }}
          animate={{ scale: [1, 1.05, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <motion.svg
        viewBox={G.viewBox}
        className="h-[62vh] max-h-[720px] w-auto overflow-visible sm:h-[68vh]"
        style={{ y: bob, scale: scale * testDim }}
        transition={{ type: "spring", stiffness: 110, damping: 18 }}
      >
        <defs>
          <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5f758c" />
            <stop offset="50%" stopColor="#2b3c4f" />
            <stop offset="100%" stopColor="#0f1822" />
          </linearGradient>
          <linearGradient id="steelDark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a3d55" />
            <stop offset="100%" stopColor="#0a0f16" />
          </linearGradient>
          <radialGradient id="coreGlow" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#7fd9ff" stopOpacity={0.85} />
            <stop offset="45%" stopColor="#00e5ff" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#005064" stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* LEGS — animated after fitting */}
        <motion.g opacity={vis.legs} animate={{ y: legOff }} transition={{ type: "spring", stiffness: 120, damping: 20 }}>
          {([-1, 1] as const).map((side) => {
            const hipX = 50 + side * G.hipX;
            const hipY = G.hipY;
            const swing = side * legSwing * 0.4;
            const kneeX = hipX + swing + side * 1.2;
            const kneeY = hipY + G.thighLen + Math.abs(kneeBend) * 0.3;
            const footX = hipX + swing * 0.6 + side * 1;
            const footY = kneeY + G.shinLen;
            const b = bolt.legs;
            return (
              <g key={side}>
                {/* hip plate with 4 screws */}
                <rect x={hipX - 5} y={hipY - 2} width={10} height={4} rx={1} fill="#1c2a3a" stroke="#0a0f16" strokeWidth={0.5} />
                <Screw x={hipX - 3} y={hipY} r={0.65} rot={b * 1080} active={b > 0.5} />
                <Screw x={hipX + 3} y={hipY} r={0.65} rot={-b * 1080} active={b > 0.5} />
                <Screw x={hipX - 3} y={hipY - 1.4} r={0.5} rot={b * 720} active={b > 0.5} />
                <Screw x={hipX + 3} y={hipY - 1.4} r={0.5} rot={-b * 720} active={b > 0.5} />
                {/* thigh — piston detail */}
                <rect x={Math.min(hipX, kneeX) - 3.2} y={hipY + 2} width={6.4} height={G.thighLen - 2} rx={2.2} fill="url(#steel)" stroke="#0a0f16" strokeWidth={0.6} />
                <line x1={hipX} y1={hipY + 4} x2={kneeX} y2={kneeY - 2} stroke="#0a0f16" strokeWidth={0.35} opacity={0.5} />
                <line x1={hipX + side * 1.5} y1={hipY + 5} x2={kneeX + side * 1} y2={kneeY - 2} stroke="#8aa0b5" strokeWidth={0.35} opacity={0.25} />
                {/* knee joint — big screw */}
                <circle cx={kneeX} cy={kneeY} r={G.jointR} fill="#1b2530" stroke="#0a0f16" strokeWidth={0.55} />
                <circle cx={kneeX} cy={kneeY} r={G.jointR * 0.48} fill="none" stroke="#8aa0b5" strokeWidth={0.32} opacity={0.4} />
                <Screw x={kneeX} y={kneeY} r={0.75} rot={b * 900} active={b > 0.5} />
                {/* shin */}
                <rect x={Math.min(kneeX, footX) - 2.6} y={kneeY + 2} width={5.2} height={G.shinLen - 2} rx={1.8} fill="#2e4158" stroke="#0a0f16" strokeWidth={0.6} />
                <circle cx={footX} cy={footY} r={2} fill="#1b2530" stroke="#0a0f16" strokeWidth={0.5} />
                {/* ankle screws */}
                <Screw x={footX - 1.2} y={footY - 0.8} r={0.5} rot={b * 600} active={b > 0.5} />
                <Screw x={footX + 1.2} y={footY - 0.8} r={0.5} rot={-b * 600} active={b > 0.5} />
                {/* foot — modern tread */}
                <rect x={footX - G.footW / 2} y={footY - 1} width={G.footW} height={5.5} rx={1.4} fill="#0f1a26" stroke="#0a0f16" strokeWidth={0.6} />
                <rect x={footX - 4} y={footY + 1} width={8} height={1.2} rx={0.6} fill="#1b2530" stroke="#0a0f16" strokeWidth={0.3} />
              </g>
            );
          })}
        </motion.g>

        {/* TORSO */}
        <motion.g opacity={vis.torso} animate={{ y: torsoOff + breath * 0.25 }} transition={{ type: "spring", stiffness: 100, damping: 18 }}>
          {/* pelvis — screw strip */}
          <rect x={50 - 19} y={G.hipY - 7} width={38} height={8} rx={2.2} fill="#1c2a3a" stroke="#0a0f16" strokeWidth={0.65} />
          <Screw x={50 - 14} y={G.hipY - 3} r={0.6} rot={bolt.torso * 720} active={bolt.torso > 0.5} />
          <Screw x={50 + 14} y={G.hipY - 3} r={0.6} rot={-bolt.torso * 720} active={bolt.torso > 0.5} />
          <Screw x={50 - 7} y={G.hipY - 3} r={0.55} rot={bolt.torso * 540} active={bolt.torso > 0.5} />
          <Screw x={50 + 7} y={G.hipY - 3} r={0.55} rot={-bolt.torso * 540} active={bolt.torso > 0.5} />

          {/* chest — modern chamfered */}
          <path
            d={`M ${50 - G.torsoW / 2} ${G.hipY - 8} L ${50 + G.torsoW / 2} ${G.hipY - 8} L ${50 + G.torsoW / 2 - 3} ${G.hipY - 9 - G.torsoH} L ${50 - G.torsoW / 2 + 3} ${G.hipY - 9 - G.torsoH} Z`}
            fill="url(#steel)"
            stroke="#0a0f16"
            strokeWidth={0.75}
          />
          {/* chest vents */}
          <g opacity={0.9}>
            <rect x={50 - 10} y={G.hipY - 30} width={3.5} height={6} rx={0.8} fill="#0f1a26" stroke="#0a0f16" strokeWidth={0.3} />
            <rect x={50 + 6.5} y={G.hipY - 30} width={3.5} height={6} rx={0.8} fill="#0f1a26" stroke="#0a0f16" strokeWidth={0.3} />
            <line x1={50} y1={G.hipY - 32} x2={50} y2={G.hipY - 12} stroke="#0a0f16" strokeWidth={0.45} opacity={0.55} />
          </g>

          {/* POWER CORE — hexagonal reactor, pulsing, connected */}
          <motion.g
            opacity={vis.core}
            animate={{ x: (1 - vis.core) * 16, scale: 0.82 + vis.core * 0.18 }}
            transition={{ type: "spring", stiffness: 140, damping: 18 }}
          >
            {/* outer hex */}
            <path d="M 50 -6 44 -2 44 6 50 10 56 6 56 -2 Z" transform={`translate(0,${G.hipY - 22})`} fill="#0f1a26" stroke="#0a0f16" strokeWidth={0.7} />
            {/* inner power glow — subtle, not large cyan halo */}
            <motion.circle
              cx={50}
              cy={G.hipY - 22}
              r={4.2}
              fill="url(#coreGlow)"
              animate={{ opacity: [0.55, 0.85, 0.55], scale: [1, 1.08, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
            <circle cx={50} cy={G.hipY - 22} r={2.6} fill="#eaf6ff" opacity={0.92} />
            <circle cx={50} cy={G.hipY - 22} r={1.1} fill="#0f1a26" stroke="#7fd9ff" strokeWidth={0.25} opacity={0.9} />
            {/* power conduits to shoulders */}
            <line x1={44} y1={G.hipY - 22} x2={34} y2={G.hipY - 28} stroke="#7fd9ff" strokeWidth={0.35} opacity={0.45} strokeDasharray="1.2 1" />
            <line x1={56} y1={G.hipY - 22} x2={66} y2={G.hipY - 28} stroke="#7fd9ff" strokeWidth={0.35} opacity={0.45} strokeDasharray="1.2 1" />
            {/* core screws */}
            <Screw x={50 - 5} y={G.hipY - 22} r={0.6} rot={bolt.core * 720} active={bolt.core > 0.5} />
            <Screw x={50 + 5} y={G.hipY - 22} r={0.6} rot={-bolt.core * 720} active={bolt.core > 0.5} />
            <Screw x={50} y={G.hipY - 28} r={0.5} rot={bolt.core * 540} active={bolt.core > 0.5} />
            <Screw x={50} y={G.hipY - 16} r={0.5} rot={-bolt.core * 540} active={bolt.core > 0.5} />
          </motion.g>

          {/* shoulders */}
          {([-1, 1] as const).map((s) => (
            <g key={s} opacity={vis.arms > 0.08 ? 1 : 0}>
              <rect x={50 + s * 17 - 6.5} y={G.hipY - 36} width={G.shoulderW} height={9} rx={2.4} fill="#2e4158" stroke="#0a0f16" strokeWidth={0.65} />
              <circle cx={50 + s * 17} cy={G.hipY - 31.5} r={2.3} fill="#1b2530" stroke="#0a0f16" strokeWidth={0.5} />
              <Screw x={50 + s * 17 - 3.5} y={G.hipY - 31.5} r={0.55} rot={bolt.arms * 600} active={bolt.arms > 0.5} />
              <Screw x={50 + s * 17 + 3.5} y={G.hipY - 31.5} r={0.55} rot={-bolt.arms * 600} active={bolt.arms > 0.5} />
            </g>
          ))}
        </motion.g>

        {/* ARMS — animated after fitting */}
        <motion.g opacity={vis.arms} animate={{ x: 0 }} transition={{ type: "spring", stiffness: 110, damping: 20 }}>
          {([-1, 1] as const).map((side) => {
            const shX = 50 + side * 17;
            const shY = G.hipY - 31.5;
            const swing = fitted ? armSwing * side * 0.12 : 0;
            const elbowX = shX + side * 6 + swing;
            const elbowY = shY + 10;
            const handX = elbowX + side * 4 + swing * 0.6;
            const handY = elbowY + 9;
            const slide = (1 - vis.arms) * side * armOff;
            return (
              <motion.g key={side} animate={{ x: slide, rotate: fitted ? swing * 0.8 : 0 }} transition={{ type: "spring", stiffness: 120, damping: 18 }} style={{ originX: shX, originY: shY }}>
                <line x1={shX} y1={shY} x2={elbowX} y2={elbowY} stroke="url(#steel)" strokeWidth={5} strokeLinecap="round" />
                <line x1={shX} y1={shY} x2={elbowX} y2={elbowY} stroke="#0a0f16" strokeWidth={0.5} opacity={0.9} />
                {/* bicep screws */}
                <Screw x={(shX + elbowX) / 2} y={(shY + elbowY) / 2} r={0.55} rot={bolt.arms * 800} active={bolt.arms > 0.5} />
                <circle cx={elbowX} cy={elbowY} r={2} fill="#1b2530" stroke="#0a0f16" strokeWidth={0.45} />
                <Screw x={elbowX} y={elbowY} r={0.7} rot={bolt.arms * 900} active={bolt.arms > 0.6} />
                <line x1={elbowX} y1={elbowY} x2={handX} y2={handY} stroke="#2e4158" strokeWidth={3.6} strokeLinecap="round" />
                {/* forearm screws */}
                <Screw x={(elbowX + handX) / 2} y={(elbowY + handY) / 2} r={0.5} rot={-bolt.arms * 700} active={bolt.arms > 0.5} />
                <circle cx={handX} cy={handY} r={1.3} fill="#1b2530" stroke="#0a0f16" strokeWidth={0.4} />
                <Screw x={handX} y={handY} r={0.6} rot={bolt.arms * 600} active={bolt.arms > 0.5} />
                {/* gripper */}
                <motion.g animate={{ rotate: fitted ? Math.sin(t * 2.2) * 4 : 0 }} style={{ originX: handX, originY: handY }}>
                  <path d={`M ${handX} ${handY} l ${side * 2.2} 1.6 l ${side * 1.1} 1`} fill="none" stroke="#0f1a26" strokeWidth={1.3} strokeLinecap="round" />
                  <path d={`M ${handX} ${handY} l ${side * -1.2} 1.6 l ${side * -0.9} 1`} fill="none" stroke="#0f1a26" strokeWidth={1.3} strokeLinecap="round" />
                </motion.g>
                {vis.arms > 0.38 && vis.arms < 0.85 && bolt.arms < 0.6 && (
                  <motion.circle cx={elbowX} cy={elbowY} r={0.65} fill="#ffb86a" animate={{ opacity: [0, 0.9, 0], scale: [0.5, 1.7, 0.5] }} transition={{ duration: 0.18, repeat: Infinity }} />
                )}
              </motion.g>
            );
          })}
        </motion.g>

        {/* HEAD — improved movement, modern face */}
        <motion.g
          opacity={vis.head}
          animate={{ y: headOff, x: headPan * 0.35, rotate: headTilt * 0.18 }}
          transition={{ type: "spring", stiffness: 90, damping: 16 }}
          style={{ originX: 50, originY: G.hipY - 42 }}
        >
          {/* head shell — more angular, crest */}
          <path d={`M ${50 - G.headW / 2} ${G.hipY - 50} L ${50 + G.headW / 2} ${G.hipY - 50} L ${50 + G.headW / 2 - 2} ${G.hipY - 34} L ${50 - G.headW / 2 + 2} ${G.hipY - 34} Z`} fill="url(#steelDark)" stroke="#0a0f16" strokeWidth={0.75} />
          <rect x={50 - G.headW / 2} y={G.hipY - 52} width={G.headW} height={3} rx={1} fill="#1c2a3a" stroke="#0a0f16" strokeWidth={0.4} />
          {/* crest vents */}
          <g opacity={0.7}>
            <line x1={47} y1={G.hipY - 50.5} x2={47} y2={G.hipY - 47.5} stroke="#0a0f16" strokeWidth={0.35} />
            <line x1={50} y1={G.hipY - 50.5} x2={50} y2={G.hipY - 47.5} stroke="#0a0f16" strokeWidth={0.35} />
            <line x1={53} y1={G.hipY - 50.5} x2={53} y2={G.hipY - 47.5} stroke="#0a0f16" strokeWidth={0.35} />
          </g>
          {/* cheek plates with screws */}
          <rect x={50 - G.headW / 2 - 4.5} y={G.hipY - 46} width={4.5} height={11} rx={1.3} fill="#1c2a3a" stroke="#0a0f16" strokeWidth={0.45} />
          <rect x={50 + G.headW / 2} y={G.hipY - 46} width={4.5} height={11} rx={1.3} fill="#1c2a3a" stroke="#0a0f16" strokeWidth={0.45} />
          <Screw x={50 - G.headW / 2 - 2.2} y={G.hipY - 40} r={0.5} rot={bolt.head * 600} active={bolt.head > 0.5} />
          <Screw x={50 + G.headW / 2 + 2.2} y={G.hipY - 40} r={0.5} rot={-bolt.head * 600} active={bolt.head > 0.5} />

          {/* FACE — dual eye visor + mouth, nod */}
          <motion.g animate={{ y: headNod * 0.15 }} transition={{ type: "spring", stiffness: 120, damping: 14 }}>
            <g opacity={vis.visor} transform={`translate(${(1 - vis.visor) * 5},0)`}>
              {/* visor plate — darker, more expressive */}
              <rect x={50 - G.visorW / 2} y={G.hipY - 41} width={G.visorW} height={G.visorH} rx={G.visorH / 2} fill="#0a121e" stroke="#0a0f16" strokeWidth={0.6} />
              {/* dual eyes */}
              <motion.ellipse
                cx={50 - 4}
                cy={G.hipY - 38.6}
                rx={3.2}
                ry={1.6}
                fill={aiGate > 0.25 ? "#7fd9ff" : "#253548"}
                animate={{ opacity: 1 - blink * 0.9, scaleY: 1 - blink * 0.7 }}
                transition={{ duration: 0.12 }}
              />
              <motion.ellipse
                cx={50 + 4}
                cy={G.hipY - 38.6}
                rx={3.2}
                ry={1.6}
                fill={aiGate > 0.25 ? "#7fd9ff" : "#253548"}
                animate={{ opacity: 1 - blink * 0.9, scaleY: 1 - blink * 0.7 }}
                transition={{ duration: 0.12 }}
              />
              {/* pupils scan */}
              {aiGate > 0.15 && aiGate < 0.88 && (
                <>
                  <motion.circle cx={50 - 4} cy={G.hipY - 38.6} r={0.7} fill="#eaf6ff" animate={{ x: [ -1.2, 1.2, -1.2] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }} />
                  <motion.circle cx={50 + 4} cy={G.hipY - 38.6} r={0.7} fill="#eaf6ff" animate={{ x: [ -1.2, 1.2, -1.2] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.1 }} />
                </>
              )}
              {/* mouth grill */}
              <rect x={50 - 3} y={G.hipY - 36.2} width={6} height={0.7} rx={0.35} fill="#0a0f16" opacity={0.7} />
              <rect x={50 - 2} y={G.hipY - 35.2} width={4} height={0.5} rx={0.25} fill="#1c2a3a" opacity={0.9} />
              {/* visor screws — full connection */}
              <Screw x={50 - G.visorW / 2 + 1.2} y={G.hipY - 38.6} r={0.55} rot={bolt.visor * 720} active={bolt.visor > 0.5} />
              <Screw x={50 + G.visorW / 2 - 1.2} y={G.hipY - 38.6} r={0.55} rot={-bolt.visor * 720} active={bolt.visor > 0.5} />
            </g>
          </motion.g>

          {/* antenna — no large glow, subtle */}
          <line x1={50} y1={G.hipY - 50} x2={50} y2={G.hipY - 57} stroke="#8aa0b5" strokeWidth={0.5} opacity={0.55} />
          <circle cx={50} cy={G.hipY - 58} r={0.9} fill={aiGate > 0.3 ? "#7fd9ff" : "#1b2530"} stroke="#0a0f16" strokeWidth={0.32} />
          {aiGate > 0.22 && aiGate < 0.78 && (
            <motion.circle cx={50} cy={G.hipY - 58} r={2} fill="none" stroke="#7fd9ff" strokeWidth={0.22} animate={{ r: [2, 3.8], opacity: [0.5, 0] }} transition={{ duration: 1.3, repeat: Infinity }} />
          )}
        </motion.g>
      </motion.svg>

      {p > T.testing[0] && p < T.testing[1] && (
        <motion.div
          className="absolute left-1/2 top-1/2 h-[62vh] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-[26px] border border-amber-500/20"
          animate={{ opacity: [0.14, 0.24, 0.14] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          style={{ boxShadow: "0 0 44px rgba(245,158,11,0.10)" }}
        />
      )}
    </div>
  );
}
