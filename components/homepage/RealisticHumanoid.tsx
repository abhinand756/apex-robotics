"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ══════════════════════════════════════════════════════════════════════════
   RIG CONSTANTS  (root-local space: +Y up, +Z forward, origin = pelvis)
   ══════════════════════════════════════════════════════════════════════════ */
const HIP_Y = -0.15;
const HIP_X = 0.165;
const L_THIGH = 0.44;
const L_SHIN = 0.44;
/* Hip -> ankle vertical drop. Leg segments total 0.88, so a fully straight leg
   would be 0.88. Standing at 0.872 leaves only ~1.2 deg of knee flex, giving
   the tall, near-straight stance silhouette instead of a deep-knee crouch. */
const ANKLE_DROP = 0.872;
const FOOT_H = 0.071; // sole sits this far below the ankle pivot
const GROUND = HIP_Y - ANKLE_DROP - FOOT_H; // -1.093 — the standing sheet surface
const CHEST_Y = 0.4;
const SHOULDER_Y = 0.46;
const SHOULDER_X = 0.29;
const HEAD_PIVOT_Y = 0.76;
const EYE_X = 0.048;
const EYE_Y = 0.042;
const EYE_Z = 0.104;
const EYE_R = 0.026;

/* ── easing / math ───────────────────────────────────────────────────────── */
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
/** frame-rate independent approach factor */
const approach = (dt: number, rate: number) => 1 - Math.exp(-rate * dt);

/** 0→1→0 pulse with independent attack / release edges. */
const pulse = (x: number, u0: number, u1: number, d0: number, d1: number) =>
  smoothstep(u0, u1, x) * (1 - smoothstep(d0, d1, x));

/** fast-close / brief-hold / slow-open blink envelope, u ∈ [0,1] */
const blinkEnv = (u: number) => (u < 0.16 ? easeOutCubic(u / 0.16) : u < 0.3 ? 1 : 1 - easeInOutSine((u - 0.3) / 0.7));

/** Live world-space anchors published for the camera director. */
export interface RobotPose {
  chest: THREE.Vector3;
  head: THREE.Vector3;
  crown: THREE.Vector3;
  sole: THREE.Vector3;
  platform: THREE.Vector3;
  facing: number;
  height: number;
}

export const makeRobotPose = (): RobotPose => ({
  chest: new THREE.Vector3(),
  head: new THREE.Vector3(),
  crown: new THREE.Vector3(),
  sole: new THREE.Vector3(),
  platform: new THREE.Vector3(),
  facing: 0,
  height: 2,
});

/* ══════════════════════════════════════════════════════════════════════════
   STATIC ENDPOINTS — module scope so memo deps stay referentially stable
   (this component re-renders whenever pHero changes; nothing must rebuild)
   ══════════════════════════════════════════════════════════════════════════ */
const P = {
  cableL: { from: [-0.14, 0.1, -0.16] as V3, to: [-0.26, 0.02, -0.03] as V3, sag: 0.035 },
  cableR: { from: [0.14, 0.1, -0.16] as V3, to: [0.26, 0.02, -0.03] as V3, sag: 0.035 },
  ram: { from: [0.052, -0.02, -0.05] as V3, to: [0.03, -0.2, -0.062] as V3 },
  quad: { from: [0, -0.07, 0.086] as V3, to: [0, -0.33, 0.086] as V3 },
  shin: { from: [0, -0.09, 0.062] as V3, to: [0, -0.36, 0.062] as V3 },
  pelvis: { from: [-0.1, -0.055, 0.135] as V3, to: [0.1, -0.055, 0.135] as V3 },
  waist: { from: [-0.1, 0.085, 0.13] as V3, to: [0.1, 0.085, 0.13] as V3 },
  sternum: { from: [0, 0.155, 0.136] as V3, to: [0, -0.13, 0.136] as V3 },
  armL: { from: [-0.058, 0.068, 0.046] as V3, to: [-0.058, -0.056, 0.046] as V3 },
  armR: { from: [0.058, 0.068, 0.046] as V3, to: [0.058, -0.056, 0.046] as V3 },
  bicepL: { from: [-0.02, -0.06, 0.044] as V3, to: [-0.02, -0.27, 0.044] as V3 },
  bicepR: { from: [0.02, -0.06, 0.044] as V3, to: [0.02, -0.27, 0.044] as V3 },
  mouthGlow: { from: [-0.034, 0.016, 0.009] as V3, to: [0.034, 0.016, 0.009] as V3 },
};
type V3 = [number, number, number];

/* ══════════════════════════════════════════════════════════════════════════
   GREEBLE PRIMITIVES
   ══════════════════════════════════════════════════════════════════════════ */
function HexBolt({ position, rotation = [0, 0, 0], scale = 1, mat }: { position: V3; rotation?: V3; scale?: number; mat: THREE.Material }) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh>
        <cylinderGeometry args={[0.013, 0.013, 0.009, 6]} />
        <primitive object={mat} attach="material" />
      </mesh>
      <mesh position={[0, 0.005, 0]}>
        <cylinderGeometry args={[0.007, 0.007, 0.005, 6]} />
        <primitive object={mat} attach="material" />
      </mesh>
    </group>
  );
}

function DamperSpring({ mat }: { mat: THREE.Material }) {
  const curve = useMemo(() => {
    const turns = 8;
    const h = 0.24;
    const r = 0.024;
    const pts: THREE.Vector3[] = [];
    const n = turns * 24;
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * turns * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(th) * r, (i / n - 0.5) * h, Math.sin(th) * r));
    }
    return new THREE.CatmullRomCurve3(pts);
  }, []);
  return (
    <mesh>
      <tubeGeometry args={[curve, 176, 0.0045, 7, false]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

function LedStrip({ a, b, mat }: { a: V3; b: V3; mat: THREE.Material }) {
  const g = useMemo(() => {
    const from = new THREE.Vector3(...a);
    const dir = new THREE.Vector3(...b).sub(from);
    const len = dir.length();
    const mid = from.clone().addScaledVector(dir, 0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return { mid, quat, len };
  }, [a, b]);
  return (
    <mesh position={g.mid} quaternion={g.quat}>
      <cylinderGeometry args={[0.004, 0.004, g.len, 8]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

/** Self-animating beacon. Owns its own emissive material so each light can
    blink out of phase with the others. */
function Blink({
  position = [0, 0, 0],
  scale = 1,
  size = 0.009,
  color = "#00e5ff",
  rate = 2.2,
  phase = 0,
  min = 0.12,
  max = 6,
}: {
  position?: V3;
  scale?: number;
  size?: number;
  color?: string;
  rate?: number;
  phase?: number;
  min?: number;
  max?: number;
}) {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: min,
        roughness: 0.15,
        toneMapped: false,
      }),
    [color, min],
  );
  useEffect(() => () => mat.dispose(), [mat]);
  const ph = useRef(phase);
  useFrame((state) => {
    ph.current = state.clock.elapsedTime * rate * Math.PI * 2 + phase;
    const v = Math.pow(Math.max(0, Math.sin(ph.current)), 5);
    mat.emissiveIntensity = min + v * (max - min);
  });
  return (
    <mesh position={position} scale={scale} material={mat}>
      <sphereGeometry args={[size, 14, 14]} />
    </mesh>
  );
}

/** Sagging cable between two static points. */
function Cable({ a, b, sag, mat }: { a: V3; b: V3; sag: number; mat: THREE.Material }) {
  const curve = useMemo(() => {
    const p0 = new THREE.Vector3(...a);
    const p1 = new THREE.Vector3(...b);
    const m = p0.clone().add(p1).multiplyScalar(0.5);
    m.y -= sag;
    return new THREE.CatmullRomCurve3([p0, m, p1]);
  }, [a, b, sag]);
  return (
    <mesh>
      <tubeGeometry args={[curve, 16, 0.006, 6, false]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
}

/** Row of cooling louvres. */
function Vents({ count, w, h, d, gap, mat }: { count: number; w: number; h: number; d: number; gap: number; mat: THREE.Material }) {
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} position={[0, (i - (count - 1) / 2) * gap, 0]}>
          <boxGeometry args={[w, h, d]} />
          <primitive object={mat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

/** Telescoping ram. Scale the returned group's Y to extend the rod. */
function Ram({ groupRef, mat }: { groupRef: (g: THREE.Group | null) => void; mat: THREE.Material }) {
  const g = useMemo(() => {
    const from = new THREE.Vector3(...P.ram.from);
    const dir = new THREE.Vector3(...P.ram.to).sub(from);
    const len = dir.length();
    return {
      len,
      origin: from.clone(),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
    };
  }, []);
  return (
    <group ref={groupRef} position={g.origin} quaternion={g.quat}>
      {/* barrel */}
      <mesh position={[0, g.len * 0.2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, g.len * 0.6, 14]} />
        <primitive object={mat} attach="material" />
      </mesh>
      <mesh position={[0, g.len * 0.5, 0]}>
        <cylinderGeometry args={[0.019, 0.019, g.len * 0.07, 12]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* rod — geometry hangs below the pivot so scaling Y extends it */}
      <group scale={[1, 1, 1]}>
        <mesh position={[0, -g.len * 0.32, 0]}>
          <cylinderGeometry args={[0.008, 0.008, g.len * 0.64, 12]} />
          <primitive object={mat} attach="material" />
        </mesh>
        <mesh position={[0, -g.len * 0.62, 0]}>
          <cylinderGeometry args={[0.012, 0.012, g.len * 0.06, 10]} />
          <primitive object={mat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   HAND — 5 three-phalanx digits, joints registered for per-frame curl
   ══════════════════════════════════════════════════════════════════════════ */
const PHALANX = [0.042, 0.031, 0.023];

/* joint y-offsets and radii, derived once from the phalanx lengths */
const SEG = (() => {
  let acc = 0;
  return PHALANX.map((len, i) => {
    const seg = { y: -(acc + len / 2), r: 0.0072 - i * 0.0012 };
    acc += len + 0.007;
    return seg;
  });
})();

function Finger({
  offset,
  joints,
  base,
  scale: sc = 1,
  M,
}: {
  offset: V3;
  joints: React.RefObject<THREE.Group[]>;
  base: number;
  scale?: number;
  M: Record<string, THREE.Material>;
}) {
  return (
    <group position={offset} scale={sc}>
      {SEG.map(({ y, r }, i) => {
        const len = PHALANX[i];
        return (
          <group
            key={i}
            position={[0, y, 0]}
            ref={(g) => {
              if (g && joints.current) joints.current[base + i] = g;
            }}
          >
            <mesh>
              <cylinderGeometry args={[r, r * 0.88, len, 10]} />
              <primitive object={M.ceramic} attach="material" />
            </mesh>
            <mesh>
              <sphereGeometry args={[r * 1.16, 10, 10]} />
              <primitive object={M.chrome} attach="material" />
            </mesh>
            {i === PHALANX.length - 1 && (
              <mesh position={[0, -len * 0.44, 0]}>
                <sphereGeometry args={[r * 0.84, 8, 8]} />
                <primitive object={M.rubber} attach="material" />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

function Hand({ joints, M }: { joints: React.RefObject<THREE.Group[]>; M: Record<string, THREE.Material> }) {
  return (
    <group>
      <mesh position={[0, -0.036, 0]} castShadow>
        <boxGeometry args={[0.072, 0.052, 0.03]} />
        <primitive object={M.chrome} attach="material" />
      </mesh>
      <mesh position={[0, -0.058, 0.016]}>
        <boxGeometry args={[0.058, 0.042, 0.008]} />
        <primitive object={M.ceramic} attach="material" />
      </mesh>
      <mesh position={[0, -0.006, -0.004]} rotation={[0.1, 0, 0]}>
        <cylinderGeometry args={[0.037, 0.033, 0.03, 16, 1, true]} />
        <primitive object={M.ceramic} attach="material" />
      </mesh>
      {[-0.026, -0.009, 0.009, 0.026].map((fx, i) => (
        <Finger key={i} offset={[fx, -0.062, 0]} joints={joints} base={i * 3} scale={0.94} M={M} />
      ))}
      {/* thumb — mirrored phalanx order so it opposes the fingers */}
      <group position={[-0.042, -0.03, 0.008]} rotation={[0, 0, 0.5]}>
        {PHALANX.map((len, i) => (
          <group
            key={i}
            position={[-0.008, -0.014 - i * 0.031, 0]}
            ref={(g) => {
              if (g && joints.current) joints.current[12 + i] = g;
            }}
          >
            <mesh>
              <cylinderGeometry args={[0.0074, 0.0064, len, 10]} />
              <primitive object={M.ceramic} attach="material" />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.0086, 10, 10]} />
              <primitive object={M.chrome} attach="material" />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function makeIrisTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (!g) return null;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2;

  /* Deep cybernetic gradient base with vibrant cyan/blue neon center */
  const base = g.createRadialGradient(cx, cy, R * 0.02, cx, cy, R);
  base.addColorStop(0, "#1ad6ff");
  base.addColorStop(0.18, "#0088cc");
  base.addColorStop(0.45, "#062840");
  base.addColorStop(0.8, "#02111d");
  base.addColorStop(1, "#01070e");
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);

  /* Sci-fi Aperture Ticks (36 radial precision marks) */
  for (let i = 0; i < 36; i++) {
    const ang = (i / 36) * Math.PI * 2;
    const r0 = R * 0.38;
    const r1 = R * (i % 3 === 0 ? 0.52 : 0.44);
    g.strokeStyle = i % 3 === 0 ? "rgba(0, 240, 255, 0.85)" : "rgba(0, 160, 230, 0.45)";
    g.lineWidth = i % 3 === 0 ? 2.5 : 1.2;
    g.beginPath();
    g.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
    g.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
    g.stroke();
  }

  /* Dense radial circuit filaments / photon strands (140 strands) */
  for (let i = 0; i < 140; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r0 = R * (0.24 + Math.random() * 0.55);
    const r1 = r0 + R * (0.05 + Math.random() * 0.22);
    const x0 = cx + Math.cos(ang) * r0;
    const y0 = cy + Math.sin(ang) * r0;
    const x1 = cx + Math.cos(ang) * r1;
    const y1 = cy + Math.sin(ang) * r1;
    const isGold = Math.random() < 0.12;
    g.strokeStyle = isGold
      ? `rgba(255, 215, 0, ${0.4 + Math.random() * 0.4})`
      : `rgba(${40 + Math.random() * 60 | 0}, ${200 + Math.random() * 55 | 0}, 255, ${0.25 + Math.random() * 0.45})`;
    g.lineWidth = 1 + Math.random() * 2.2;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }

  /* Concentric HUD aperture rings & glowing energy bands */
  const ringRadii = [
    { r: 0.28, w: 1.5, color: "rgba(0, 240, 255, 0.9)" },
    { r: 0.36, w: 2.2, color: "rgba(0, 210, 255, 0.6)" },
    { r: 0.54, w: 1.8, color: "rgba(100, 220, 255, 0.4)" },
    { r: 0.72, w: 2.5, color: "rgba(0, 229, 255, 0.3)" },
    { r: 0.85, w: 1.2, color: "rgba(0, 180, 255, 0.25)" },
  ];
  for (const ring of ringRadii) {
    g.strokeStyle = ring.color;
    g.lineWidth = ring.w;
    g.beginPath();
    g.arc(cx, cy, R * ring.r, 0, Math.PI * 2);
    g.stroke();
  }

  /* Aperture Blade Accents (Hexagonal robotic diaphragm geometry) */
  g.strokeStyle = "rgba(0, 240, 255, 0.45)";
  g.lineWidth = 1.8;
  g.beginPath();
  for (let i = 0; i <= 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const rx = cx + Math.cos(ang) * R * 0.48;
    const ry = cy + Math.sin(ang) * R * 0.48;
    if (i === 0) g.moveTo(rx, ry);
    else g.lineTo(rx, ry);
  }
  g.stroke();

  /* Outer Limbal Collar — crisp dark transition */
  g.strokeStyle = "rgba(1, 6, 12, 0.95)";
  g.lineWidth = R * 0.18;
  g.beginPath();
  g.arc(cx, cy, R * 0.91, 0, Math.PI * 2);
  g.stroke();

  /* Deep central pupil falloff */
  const pup = g.createRadialGradient(cx, cy, R * 0.01, cx, cy, R * 0.28);
  pup.addColorStop(0, "#010306");
  pup.addColorStop(0.8, "rgba(1, 4, 8, 0.95)");
  pup.addColorStop(1, "rgba(1, 4, 8, 0)");
  g.fillStyle = pup;
  g.fillRect(0, 0, size, size);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

/* ══════════════════════════════════════════════════════════════════════════
   EYE — curved, textured iris inside a glossy wet cornea, with almond lids
   ══════════════════════════════════════════════════════════════════════════ */
function Eye({
  tilt,
  M,
  gazeRef,
  upperRef,
  lowerRef,
  pupilRef,
  irisRef,
}: {
  tilt: number;
  M: Record<string, THREE.Material>;
  gazeRef: React.RefObject<THREE.Group | null>;
  upperRef: React.RefObject<THREE.Group | null>;
  lowerRef: React.RefObject<THREE.Group | null>;
  pupilRef: React.RefObject<THREE.Mesh | null>;
  irisRef?: React.RefObject<THREE.MeshStandardMaterial | null>;
}) {
  const rim = EYE_R * 1.36;
  const DOME = EYE_R * 1.06;
  return (
    <group>
      {/* Recessed Dark Orbit Socket */}
      <mesh rotation={[tilt, 0, 0]}>
        <torusGeometry args={[EYE_R * 1.2, 0.006, 12, 32]} />
        <primitive object={M.socket} attach="material" />
      </mesh>

      {/* Eyeball — rotates for gaze */}
      <group ref={gazeRef}>
        {/* Dark Obsidian Sclera */}
        <mesh>
          <sphereGeometry args={[EYE_R, 36, 28]} />
          <primitive object={M.sclera} attach="material" />
        </mesh>

        {/* Iris — curved high-tech dome with cyber iris graphic */}
        <mesh position={[0, 0, 0.001]} rotation={[tilt * 0.5, 0, 0]}>
          <sphereGeometry args={[DOME, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.48]} />
          <primitive ref={irisRef} object={M.iris} attach="material" />
        </mesh>

        {/* Pupil Disc — sits proud of dome */}
        <mesh ref={pupilRef} position={[0, 0, DOME + 0.0028]}>
          <circleGeometry args={[EYE_R * 0.22, 28]} />
          <primitive object={M.pupil} attach="material" />
        </mesh>

        {/* Limbal Collar — dark transition */}
        <mesh position={[0, 0, DOME * 0.985]}>
          <ringGeometry args={[EYE_R * 0.6, EYE_R * 0.74, 40]} />
          <meshBasicMaterial color="#010610" transparent opacity={0.8} depthWrite={false} />
        </mesh>

        {/* Clear Glossy Wet Cornea */}
        <mesh>
          <sphereGeometry args={[EYE_R * 1.05, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <primitive object={M.cornea} attach="material" />
        </mesh>

        {/* Specular Window Glints */}
        <mesh position={[-EYE_R * 0.32, EYE_R * 0.38, EYE_R * 1.05]}>
          <circleGeometry args={[EYE_R * 0.18, 16]} />
          <primitive object={M.shine} attach="material" />
        </mesh>
        <mesh position={[EYE_R * 0.26, -EYE_R * 0.14, EYE_R * 1.05]}>
          <circleGeometry args={[EYE_R * 0.07, 12]} />
          <primitive object={M.shine} attach="material" />
        </mesh>
      </group>

      {/* UPPER LID — Clean dark eyelid shell without distracting rings */}
      <group ref={upperRef}>
        <mesh>
          <sphereGeometry args={[rim, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.54]} />
          <primitive object={M.lid} attach="material" />
        </mesh>
      </group>

      {/* LOWER LID — Clean dark eyelid shell */}
      <group ref={lowerRef}>
        <group rotation={[0, 0, Math.PI]}>
          <mesh>
            <sphereGeometry args={[rim, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.54]} />
            <primitive object={M.lid} attach="material" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LEG — analytic 2-bone IK
   lateral(Z) → aim(X pitch) → thigh → knee(X flex) → shin → ankle(X level) → toe
   ══════════════════════════════════════════════════════════════════════════ */
interface LegRefs {
  lateral: React.RefObject<THREE.Group | null>;
  aim: React.RefObject<THREE.Group | null>;
  knee: React.RefObject<THREE.Group | null>;
  ankle: React.RefObject<THREE.Group | null>;
  toe: React.RefObject<THREE.Group | null>;
  ram: React.RefObject<THREE.Group | null>;
}

const makeLegRefs = (): LegRefs => ({
  lateral: { current: null } as React.RefObject<THREE.Group | null>,
  aim: { current: null } as React.RefObject<THREE.Group | null>,
  knee: { current: null } as React.RefObject<THREE.Group | null>,
  ankle: { current: null } as React.RefObject<THREE.Group | null>,
  toe: { current: null } as React.RefObject<THREE.Group | null>,
  ram: { current: null } as React.RefObject<THREE.Group | null>,
});

function Leg({
  side,
  M,
  onRefs,
}: {
  side: 1 | -1;
  M: Record<string, THREE.Material>;
  onRefs: (r: LegRefs) => void;
}) {
  const lateral = useRef<THREE.Group>(null);
  const aim = useRef<THREE.Group>(null);
  const knee = useRef<THREE.Group>(null);
  const ankle = useRef<THREE.Group>(null);
  const toe = useRef<THREE.Group>(null);
  const ram = useRef<THREE.Group>(null);

  useEffect(() => {
    onRefs({ lateral, aim, knee, ankle, toe, ram });
  }, [onRefs]);

  return (
    <group ref={lateral} position={[side * HIP_X, HIP_Y, 0]}>
      {/* hip socket */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.077, 0.077, 0.052, 30]} />
        <primitive object={M.chrome} attach="material" />
      </mesh>
      <mesh position={[-side * 0.028, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.055, 0.071, 0.006, 30]} />
        <primitive object={M.gold} attach="material" />
      </mesh>
      <mesh position={[-side * 0.031, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.032, 0.049, 0.006, 30]} />
        <primitive object={M.dark} attach="material" />
      </mesh>
      <HexBolt position={[-side * 0.032, 0, 0]} rotation={[0, 0, Math.PI / 2]} mat={M.chrome} />

      <group ref={aim}>
        {/* thigh shell over exposed inner frame */}
        <mesh position={[0, -L_THIGH * 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.087, 0.068, L_THIGH * 0.86, 28]} />
          <primitive object={M.ceramic} attach="material" />
        </mesh>
        <mesh position={[side * 0.03, -L_THIGH * 0.5, -0.028]}>
          <cylinderGeometry args={[0.026, 0.026, L_THIGH * 0.8, 12]} />
          <primitive object={M.chrome} attach="material" />
        </mesh>
        {/* lateral armour plate */}
        <mesh position={[side * 0.053, -L_THIGH * 0.5, 0.014]} rotation={[0, -side * 0.14, side * 0.03]} castShadow>
          <boxGeometry args={[0.03, L_THIGH * 0.74, 0.088]} />
          <primitive object={M.titan} attach="material" />
        </mesh>
        {/* front quad plate */}
        <mesh position={[0, -L_THIGH * 0.52, 0.07]} rotation={[0.05, 0, 0]}>
          <boxGeometry args={[0.072, L_THIGH * 0.5, 0.02]} />
          <primitive object={M.ceramic} attach="material" />
        </mesh>
        <LedStrip a={P.quad.from} b={P.quad.to} mat={M.cyanDim} />
        <HexBolt position={[side * 0.05, -0.1, 0.058]} mat={M.gold} />
        <HexBolt position={[side * 0.05, -0.31, 0.058]} mat={M.gold} />

        <group ref={knee} position={[0, -L_THIGH, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.136, 28]} />
            <primitive object={M.chrome} attach="material" />
          </mesh>
          {/* patella */}
          <mesh position={[0, 0.006, 0.05]} rotation={[0.12, 0, 0]} castShadow>
            <sphereGeometry args={[0.051, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
            <primitive object={M.ceramic} attach="material" />
          </mesh>
          <mesh position={[0, 0.014, 0.058]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.05, 0.03, 0.016]} />
            <primitive object={M.gold} attach="material" />
          </mesh>
          <Blink position={[0, 0.006, 0.066]} size={0.007} color="#00e5ff" rate={3.1} phase={side < 0 ? 0.8 : 2.4} min={0.05} max={5} />
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.083, 0.083, 0.005, 28]} />
            <primitive object={M.gold} attach="material" />
          </mesh>
          <HexBolt position={[-side * 0.07, 0, 0]} rotation={[0, 0, Math.PI / 2]} mat={M.gold} />
          <HexBolt position={[0, 0, 0.072]} rotation={[Math.PI / 2, 0, 0]} mat={M.chrome} />

          <Ram groupRef={(g) => { ram.current = g; }} mat={M.chrome} />

          {/* calf */}
          <mesh position={[0, -L_SHIN * 0.5, -0.006]} castShadow>
            <cylinderGeometry args={[0.067, 0.046, L_SHIN * 0.84, 28]} />
            <primitive object={M.ceramic} attach="material" />
          </mesh>
          <mesh position={[0, -L_SHIN * 0.26, -0.038]} rotation={[0.1, 0, 0]}>
            <sphereGeometry args={[0.056, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            <primitive object={M.ceramic} attach="material" />
          </mesh>
          <mesh position={[0, -L_SHIN * 0.5, 0.05]}>
            <boxGeometry args={[0.05, L_SHIN * 0.62, 0.022]} />
            <primitive object={M.titan} attach="material" />
          </mesh>
          <LedStrip a={P.shin.from} b={P.shin.to} mat={M.cyanDim} />
          {/* Achilles damper stack */}
          <group position={[0, -0.2, -0.054]}>
            <mesh>
              <cylinderGeometry args={[0.014, 0.014, 0.28, 10]} />
              <primitive object={M.chrome} attach="material" />
            </mesh>
            <DamperSpring mat={M.gold} />
          </group>

          <group ref={ankle} position={[0, -L_SHIN, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.042, 0.042, 0.1, 22]} />
              <primitive object={M.chrome} attach="material" />
            </mesh>
            <mesh position={[0, -0.014, 0.006]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.051, 0.051, 0.006, 22]} />
              <primitive object={M.gold} attach="material" />
            </mesh>
            {/* heel */}
            <mesh position={[0, -0.026, -0.062]} castShadow>
              <boxGeometry args={[0.082, 0.05, 0.05]} />
              <primitive object={M.dark} attach="material" />
            </mesh>
            {/* mid-foot */}
            <mesh position={[0, -0.031, 0.014]} castShadow receiveShadow>
              <boxGeometry args={[0.098, 0.042, 0.112]} />
              <primitive object={M.ceramic} attach="material" />
            </mesh>
            {/* sole */}
            <mesh position={[0, -0.052, 0.02]}>
              <boxGeometry args={[0.104, 0.014, 0.202]} />
              <primitive object={M.dark} attach="material" />
            </mesh>
            {/* toe — articulates through the gait cycle.
                Bottom faces are kept coplanar with the sole (-0.059) so the
                toe never punches through the standing sheet. */}
            <group ref={toe} position={[0, -0.033, 0.07]}>
              <mesh position={[0, -0.007, 0.037]} castShadow>
                <boxGeometry args={[0.092, 0.038, 0.076]} />
                <primitive object={M.ceramic} attach="material" />
              </mesh>
              <mesh position={[0, -0.020, 0.05]}>
                <boxGeometry args={[0.096, 0.012, 0.064]} />
                <primitive object={M.dark} attach="material" />
              </mesh>
              <mesh position={[0, -0.008, 0.072]} rotation={[0.5, 0, 0]}>
                <boxGeometry args={[0.084, 0.03, 0.014]} />
                <primitive object={M.chrome} attach="material" />
              </mesh>
            </group>
            <HexBolt position={[-0.036, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} mat={M.chrome} />
            <HexBolt position={[0.036, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} mat={M.chrome} />
            <HexBolt position={[0, 0.012, -0.05]} rotation={[-Math.PI / 2, 0, 0]} mat={M.gold} />
          </group>
        </group>
      </group>
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   THE ROBOT
   ══════════════════════════════════════════════════════════════════════════ */

export function RealisticHumanoid({
  progress,
  poseRef,
}: {
  progress: React.RefObject<number>;
  poseRef: React.RefObject<RobotPose>;
}) {
  const root = useRef<THREE.Group>(null);
  const pelvisOffset = useRef<THREE.Group>(null);
  const pelvisYaw = useRef<THREE.Group>(null);
  const pelvisRoll = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const headGroup = useRef<THREE.Group>(null);
  const aChest = useRef<THREE.Object3D>(null);
  const aHead = useRef<THREE.Object3D>(null);
  const aCrown = useRef<THREE.Object3D>(null);
  const aSole = useRef<THREE.Object3D>(null);
  const aPlat = useRef<THREE.Object3D>(null);

  const legs = useRef<{ L: LegRefs; R: LegRefs }>({ L: makeLegRefs(), R: makeLegRefs() });
  const regL = useCallback((r: LegRefs) => {
    legs.current.L = r;
  }, []);
  const regR = useCallback((r: LegRefs) => {
    legs.current.R = r;
  }, []);
  const fingersL = useRef<THREE.Group[]>([]);
  const fingersR = useRef<THREE.Group[]>([]);

  const gazeL = useRef<THREE.Group>(null);
  const gazeR = useRef<THREE.Group>(null);
  const lidUL = useRef<THREE.Group>(null);
  const lidLL = useRef<THREE.Group>(null);
  const lidUR = useRef<THREE.Group>(null);
  const lidLR = useRef<THREE.Group>(null);
  const pupL = useRef<THREE.Mesh>(null);
  const pupR = useRef<THREE.Mesh>(null);
  const irisMat = useRef<THREE.MeshStandardMaterial>(null);
  const browL = useRef<THREE.Group>(null);
  const browR = useRef<THREE.Group>(null);
  const mouth = useRef<THREE.Mesh>(null);
  const mouthMat = useRef<THREE.MeshStandardMaterial>(null);
  const coreMesh = useRef<THREE.Mesh>(null);
  const coreRing = useRef<THREE.Mesh>(null);
  const coreSpokes = useRef<THREE.Group>(null);
  const chestLight = useRef<THREE.PointLight>(null);
  const eyeLightL = useRef<THREE.PointLight>(null);
  const eyeLightR = useRef<THREE.PointLight>(null);
  const shL = useRef<THREE.Group>(null);
  const shR = useRef<THREE.Group>(null);
  const elL = useRef<THREE.Group>(null);
  const elR = useRef<THREE.Group>(null);
  const wrL = useRef<THREE.Group>(null);
  const wrR = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Group>(null);

  const pointer = useRef(new THREE.Vector2());
  const st = useRef({
    walk: 0,
    phase: 0,
    curl: 0.12,
    blinkAt: 1.6,
    blinkU: -1,
    saccAt: 0.8,
    sxu: 0,
    syu: 0,
    saccT: 1,
    ptr: new THREE.Vector2(),
  });
  const scratch = useMemo(
    () => ({
      v: new THREE.Vector3(),
      ax: new THREE.Vector3(0, 0, 1),
      ay: new THREE.Vector3(0, 1, 0),
      shift: new THREE.Vector3(),
      probe: new THREE.Vector3(),
      q: new THREE.Quaternion(),
    }),
    [],
  );

  /* ── Materials ─────────────────────────────────────────────────────────── */
  const irisTex = useMemo(() => makeIrisTexture(), []);
  const M = useMemo(() => {
    const mk = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
    return {
      ceramic: mk({ color: "#eef3f8", roughness: 0.14, metalness: 0.18, envMapIntensity: 1.3 }),
      chrome: mk({ color: "#e6edf3", roughness: 0.035, metalness: 1, envMapIntensity: 2.2 }),
      titan: mk({ color: "#78899a", roughness: 0.3, metalness: 0.92, envMapIntensity: 1.4 }),
      dark: mk({ color: "#0a0f16", roughness: 0.34, metalness: 0.85, envMapIntensity: 0.9 }),
      rubber: mk({ color: "#080a12", roughness: 0.85, metalness: 0.05 }),
      gold: mk({ color: "#d6a828", roughness: 0.14, metalness: 0.96, envMapIntensity: 1.8 }),
      cyanGlow: mk({ color: "#00e5ff", emissive: "#00e5ff", emissiveIntensity: 6, roughness: 0, toneMapped: false }),
      cyanDim: mk({ color: "#00c8e6", emissive: "#0092b0", emissiveIntensity: 1.8, roughness: 0.2, transparent: true, opacity: 0.82 }),
      face: mk({ color: "#f3f6f9", roughness: 0.24, metalness: 0.08, envMapIntensity: 1.1 }),
      lid: mk({ color: "#060b12", roughness: 0.2, metalness: 0.85, side: THREE.DoubleSide, envMapIntensity: 1.2 }),
      lidEdge: mk({ color: "#09101a", roughness: 0.25, metalness: 0.8 }),
      socket: mk({ color: "#010408", roughness: 0.5, metalness: 0.9 }),
      sclera: mk({ color: "#020710", roughness: 0.12, metalness: 0.9, envMapIntensity: 2.2 }),
      iris: irisTex
        ? mk({ map: irisTex, color: "#0a2330", emissive: "#00e5ff", emissiveIntensity: 4, roughness: 0.08, metalness: 0.05, toneMapped: false })
        : mk({ color: "#00e6ff", emissive: "#00e5ff", emissiveIntensity: 3.5, roughness: 0, toneMapped: false }),
      cornea: new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.14,
        roughness: 0.04,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 2.8,
        toneMapped: false,
      }),
      pupil: mk({ color: "#02060a", roughness: 0.1, metalness: 0.4 }),
      shine: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95, toneMapped: false }),
      platform: mk({ color: "#151c26", roughness: 0.6, metalness: 0.55, envMapIntensity: 0.7 }),
      platformEdge: mk({ color: "#0b1017", roughness: 0.75, metalness: 0.4 }),
    };
  }, [irisTex]);

  /* ── baked contact shadow (part of the sheet, not a separate layer) ───── */
  const shadowTex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    if (!g) return null;
    const grd = g.createRadialGradient(128, 128, 6, 128, 128, 126);
    grd.addColorStop(0, "rgba(0,0,0,0.88)");
    grd.addColorStop(0.4, "rgba(0,0,0,0.46)");
    grd.addColorStop(0.72, "rgba(0,0,0,0.14)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  /* Global window mousemove listener for 100% reliable cursor tracking */
  const mouseRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(
    () => () => {
      shadowTex?.dispose();
      irisTex?.dispose();
    },
    [shadowTex, irisTex],
  );

  /* ══════════════════════════════════════════════════════════════════════
     ANIMATION
     ══════════════════════════════════════════════════════════════════════ */
  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 30);
    const T = state.clock.elapsedTime;
    const p = progress.current ?? 0;
    const S = st.current;

    /* Smoothly track global window cursor position */
    pointer.current.x += (mouseRef.current.x - pointer.current.x) * approach(dt, 8);
    pointer.current.y += (mouseRef.current.y - pointer.current.y) * approach(dt, 8);

    /* stage weights — peaks at 0.10 / 0.30 / 0.50 / 0.70 / 0.90 */
    const s1 = Math.max(0, 1 - Math.abs(p - 0.1) / 0.13);
    const s2 = Math.max(0, 1 - Math.abs(p - 0.3) / 0.13);
    const s3 = Math.max(0, 1 - Math.abs(p - 0.5) / 0.13);
    const s4 = Math.max(0, 1 - Math.abs(p - 0.7) / 0.13);
    const s5 = clamp((p - 0.8) / 0.18, 0, 1);

    const breath = Math.sin(T * 1.35) * 0.009;
    const sway = Math.sin(T * 0.55) * 0.008;

    /* S1 greeting weight — declared up front because the head, hands and arms
       sections below all key off it. */
    const greet = s1 * (1 - Math.max(s2, s3, s4, s5));
    const wave = greet * (Math.sin(T * 6.2) * 0.62 + Math.sin(T * 12.4) * 0.18);

    /* gait + crouch schedule */
    const walkTarget = clamp(pulse(p, 0.12, 0.16, 0.25, 0.3) + pulse(p, 0.6, 0.64, 0.78, 0.84), 0, 1);
    const crouch = pulse(p, 0.62, 0.68, 0.77, 0.83) * 0.34;
    S.walk += (walkTarget - S.walk) * approach(dt, 5);
    S.phase = (S.phase + dt * 0.62 * S.walk * Math.PI * 2) % (Math.PI * 2);
    const W = S.walk;
    const ph = S.phase;

    /* ── root ── */
    if (root.current) {
      const tx = s2 * 0.5 - s3 * 0.32 + sway * 0.4;
      const tz = s5 * 0.3;
      // Reduced s2 yaw from -0.34 to -0.16 so platform does not rotate too far left
      const ry = -s2 * 0.16 + s3 * 0.18 + s5 * 0.12 + pointer.current.x * 0.06 * (1 - Math.max(s2, s3));
      const k = approach(dt, 4.2);
      root.current.position.x += (tx - root.current.position.x) * k;
      root.current.position.z += (tz - root.current.position.z) * k;
      root.current.rotation.y += (ry - root.current.rotation.y) * k;
      root.current.position.y = -0.38 + breath - crouch * 0.03 + Math.abs(Math.sin(ph)) * 0.026 * W;
    }

    /* ── pelvis ── */
    if (pelvisOffset.current) {
      const lat = W > 0.01 ? Math.cos(ph) * 0.038 * W : Math.sin(T * 0.42) * 0.008;
      const drop = crouch * 0.02 + Math.abs(Math.sin(ph)) * 0.008 * W;
      const k = approach(dt, 7);
      pelvisOffset.current.position.x += (lat - pelvisOffset.current.position.x) * k;
      pelvisOffset.current.position.y += (-drop - pelvisOffset.current.position.y) * k;
    }
    if (pelvisYaw.current) {
      const idleYaw = W > 0.01 ? 0 : Math.sin(T * 0.27) * 0.05 + Math.sin(T * 0.41) * 0.02;
      const v = W > 0.01 ? -Math.sin(ph) * 0.13 * W : idleYaw;
      pelvisYaw.current.rotation.y += (v - pelvisYaw.current.rotation.y) * approach(dt, 8);
    }
    if (pelvisRoll.current) {
      const idleRoll = W > 0.01 ? 0 : Math.sin(T * 0.23 + 1.1) * 0.03;
      const v = W > 0.01 ? Math.cos(ph) * 0.055 * W : idleRoll;
      pelvisRoll.current.rotation.z += (v - pelvisRoll.current.rotation.z) * approach(dt, 8);
    }
    if (torso.current) {
      const k = approach(dt, 5);
      const idleCounter = W > 0.01 ? 0 : -Math.sin(T * 0.27) * 0.035;
      torso.current.rotation.y +=
        ((W > 0.01 ? Math.sin(ph) * 0.15 * W : 0) + idleCounter - torso.current.rotation.y) * k;
      torso.current.rotation.x += (s4 * 0.15 + crouch * 0.18 + s2 * 0.05 - torso.current.rotation.x) * k;
    }

    /* ── LEG IK ── */
    const yawR = pelvisYaw.current?.rotation.y ?? 0;
    const rollR = pelvisRoll.current?.rotation.z ?? 0;
    const poX = pelvisOffset.current?.position.x ?? 0;
    const poY = pelvisOffset.current?.position.y ?? 0;
    const v = scratch.v;
    const SHIFT = scratch.shift;

    const solveLeg = (r: LegRefs, side: 1 | -1, phase: number) => {
      if (!r.lateral.current || !r.aim.current || !r.knee.current || !r.ankle.current || !r.toe.current) return;

      let fz = 0.006 + Math.sin(T * 0.5) * 0.005;
      let fy = GROUND + FOOT_H;
      let toeRoll = 0;
      if (W > 0.012) {
        const u = (((phase / (Math.PI * 2)) % 1) + 1) % 1;
        const stride = 0.3 * W;
        if (u < 0.5) {
          fz = stride * 0.5 - stride * (u / 0.5);
          toeRoll = -0.05 * Math.sin((u / 0.5) * Math.PI);
        } else {
          const w = (u - 0.5) / 0.5;
          fz = -stride * 0.5 + stride * w;
          fy += 0.085 * Math.sin(w * Math.PI) * W;
          toeRoll = 0.3 * Math.sin(w * Math.PI) * W;
        }
      }
      const fx = side * 0.175;

      v.set(fx - poX, fy - poY, fz);
      v.applyAxisAngle(scratch.ax, -rollR);
      v.applyAxisAngle(scratch.ay, -yawR);
      v.sub(SHIFT.set(side * HIP_X, HIP_Y, 0));

      const d = clamp(Math.hypot(v.x, v.y, v.z), Math.abs(L_THIGH - L_SHIN) + 2e-3, L_THIGH + L_SHIN - 2e-3);
      const aH = Math.acos(clamp((L_THIGH * L_THIGH + d * d - L_SHIN * L_SHIN) / (2 * L_THIGH * d), -1, 1));
      const aA = Math.acos(clamp((L_SHIN * L_SHIN + d * d - L_THIGH * L_THIGH) / (2 * L_SHIN * d), -1, 1));
      const p0 = Math.atan2(-v.z, -v.y);
      const roll = clamp(Math.atan2(v.x, Math.max(1e-4, Math.hypot(v.y, v.z))), -0.5, 0.5);

      r.lateral.current.rotation.z = roll;
      r.aim.current.rotation.x = p0 - aH;
      r.knee.current.rotation.x = aH + aA;
      r.ankle.current.rotation.x = -p0 - aA + toeRoll;
      r.ankle.current.rotation.z = -roll - rollR;

      if (r.ram.current) {
        const ext = 1 - clamp((d - (L_THIGH + L_SHIN - 0.07)) / 0.17, 0, 1);
        r.ram.current.scale.y = 0.5 + ext * 0.85;
      }
    };

    solveLeg(legs.current.L, -1, ph);
    solveLeg(legs.current.R, 1, ph + Math.PI);

    /* ── HEAD ──
       Head ALWAYS turns with mouse cursor movement (pointer.current) on top of active stage direction.
       Left content (viewer's left) = -0.45 yaw. Right content (viewer's right) = +0.45 yaw. */
    if (headGroup.current) {
      let baseHy = 0;
      let baseHx = 0;
      if (s1 > 0.2) { baseHy = -0.45; baseHx = 0.02; }       // Step 1: Left content -> Turn head LEFT
      else if (s2 > 0.2) { baseHy = 0.45; baseHx = 0.04; }   // Step 2: Right content -> Turn head RIGHT
      else if (s3 > 0.2) { baseHy = -0.45; baseHx = -0.02; } // Step 3: Left content -> Turn head LEFT
      else if (s4 > 0.2) { baseHy = 0.45; baseHx = 0.04; }   // Step 4: Right content -> Turn head RIGHT
      else if (s5 > 0.2) { baseHy = 0.0; baseHx = -0.04; }   // Step 5: Center for Tony Stark pose

      /* Always track cursor pointer on top of base stage gaze */
      const hy = baseHy + pointer.current.x * 0.45;
      const hx = baseHx - pointer.current.y * 0.35;
      const hz = s5 > 0.3 ? 0 : Math.sin(T * 0.33) * 0.04;

      const kHead = approach(dt, 7.0);
      headGroup.current.rotation.y += (hy - headGroup.current.rotation.y) * kHead;
      headGroup.current.rotation.x += (hx - headGroup.current.rotation.x) * kHead;
      headGroup.current.rotation.z += (hz - headGroup.current.rotation.z) * kHead;
    }

    /* ── GAZE + SACCADES ── */
    const think = s3;
    const lockOn = s1;
    const gx = think > 0.25 ? -0.3 : lockOn > 0.2 ? -pointer.current.x * 0.18 : pointer.current.x * 0.3;
    const gy = (think > 0.25 ? 0.12 : lockOn > 0.2 ? -0.02 : pointer.current.y * 0.2) + Math.sin(T * 0.9) * 0.012;
    if (T > S.saccAt) {
      S.saccAt = T + 0.5 + Math.random() * (think > 0.25 ? 2.6 : lockOn > 0.2 ? 1.8 : 1.1);
      S.sxu = (Math.random() - 0.5) * 0.3 * (lockOn > 0.2 ? 0.35 : 1);
      S.syu = (Math.random() - 0.5) * 0.16;
      S.saccT = 0;
    }
    S.saccT = Math.min(1, S.saccT + dt * 11);
    const sc = easeOutCubic(S.saccT);
    const txg = lerp(gx, S.sxu, sc * 0.7);
    const tyg = lerp(gy, S.syu, sc * 0.7);
    const gk = approach(dt, 16);
    if (gazeL.current) {
      gazeL.current.rotation.y += (txg - gazeL.current.rotation.y) * gk;
      gazeL.current.rotation.x += (tyg - gazeL.current.rotation.x) * gk;
    }
    if (gazeR.current) {
      gazeR.current.rotation.y += (txg * 0.94 - gazeR.current.rotation.y) * gk;
      gazeR.current.rotation.x += (tyg - gazeR.current.rotation.x) * gk;
    }

    /* ── BLINK ── */
    const dur = think > 0.25 ? 0.46 : 0.26;
    if (T > S.blinkAt) {
      S.blinkU = 0;
      S.blinkAt = T + dur + 1.2 + Math.random() * (think > 0.25 ? 4.4 : 2.8);
    }
    if (S.blinkU >= 0) {
      S.blinkU += dt / dur;
      if (S.blinkU > 1) S.blinkU = -1;
    }
    const closed = S.blinkU >= 0 ? blinkEnv(S.blinkU) : 0;
    const lk = approach(dt, 34);
    const applyLid = (up: THREE.Group | null, lo: THREE.Group | null) => {
      if (up) up.rotation.x += (lerp(-0.42, 0.78, closed) - up.rotation.x) * lk;
      if (lo) lo.rotation.x += (lerp(-0.22, 0.55, closed) - lo.rotation.x) * lk;
    };
    applyLid(lidUL.current, lidLL.current);
    applyLid(lidUR.current, lidLR.current);

    /* ── BROWS ── */
    const bn = closed * 0.5 + think * 0.2 - (s2 > 0.4 ? 0.1 : 0);
    if (browL.current) {
      browL.current.rotation.z += (0.06 + bn - browL.current.rotation.z) * lk;
      browL.current.position.y = 0.086 - bn * 0.006;
    }
    if (browR.current) {
      browR.current.rotation.z += (-0.06 - bn - browR.current.rotation.z) * lk;
      browR.current.position.y = 0.086 - bn * 0.006;
    }

    /* ── PUPIL / IRIS ── */
    const dil = 1 + Math.sin(T * 0.7) * 0.12 + think * 0.35 - closed * 0.25;
    pupL.current?.scale.setScalar(dil);
    pupR.current?.scale.setScalar(dil);
    const eBoost = s3 * 5 + s5 * 3.4 + s2 * 1.2;
    const eI = Math.max(0.2, (1 - closed * 0.9) * (5.5 + Math.sin(T * 3.4) * 0.9) + eBoost);
    const iris = irisMat.current;
    if (iris) iris.emissiveIntensity += (eI - iris.emissiveIntensity) * approach(dt, 8);
    const eP = (1 - closed) * (0.9 + eBoost * 0.35);
    if (eyeLightL.current) eyeLightL.current.intensity += (eP - eyeLightL.current.intensity) * approach(dt, 8);
    if (eyeLightR.current) eyeLightR.current.intensity += (eP - eyeLightR.current.intensity) * approach(dt, 8);

    /* ── MOUTH ── */
    if (mouth.current) mouth.current.scale.y = 0.35 + (s4 * 0.5 + Math.max(0, Math.sin(T * 3.1)) * 0.07 + s2 * 0.2) * 1.4;
    if (mouthMat.current) mouthMat.current.emissiveIntensity = 1.2 + s5 * 4 + closed * 0.6;

    /* ── CHEST CORE ── */
    const beat = Math.pow(Math.max(0, Math.sin(T * 2.4)), 6);
    if (coreMesh.current) {
      coreMesh.current.scale.setScalar(0.9 + beat * 0.25 + s5 * 0.2 + s3 * 0.15);
      coreMesh.current.rotation.z += dt * 0.5;
    }
    if (coreRing.current) {
      coreRing.current.scale.setScalar(0.9 + beat * 0.55 + s5 * 0.3);
      coreRing.current.rotation.z += dt * 0.4;
    }
    if (coreSpokes.current) {
      coreSpokes.current.rotation.z += dt * (2.1 + beat * 2.8 + s3 * 1.2);
    }
    if (chestLight.current) {
      const ci = 1.2 + s5 * 4.2 + s3 * 2.4 + beat * 1.1;
      chestLight.current.intensity += (ci - chestLight.current.intensity) * approach(dt, 10);
    }

    /* ── HANDS ──
       In S1, fingers rhythmically close & open in a smooth servo cycle.
       In S5, fingers splay open for the Tony Stark repulsor pose. */
    const s1FingerPulse = s1 > 0.05 ? (Math.sin(T * 3.4) * 0.5 + 0.5) * 0.8 : 0;
    const baseCurl = lerp(0.12, 0.62, clamp(s3 * 0.6 + s2 * 0.5 + s4 * 0.4, 0, 1)) * (1 - s1 * 0.95) * (1 - s5 * 0.98);
    const curlTarget = s5 > 0.3 ? -0.15 : (baseCurl + s1FingerPulse);

    S.curl += (clamp(curlTarget, -0.2, 1.05) - S.curl) * approach(dt, 6);
    const ripple = s2 * 0.4 + s3 * 0.4 + s4 * 0.4;
    const curlFingers = (arr: THREE.Group[], phase: number) => {
      for (let i = 0; i < arr.length; i++) {
        const j = arr[i];
        const trail = ripple > 0 ? Math.sin(T * 3.2 - i * 0.85 + phase) * 0.12 * ripple : 0;
        if (j) j.rotation.x = -(S.curl + trail) * ((i % 3) + 1) * 0.55;
      }
    };
    curlFingers(fingersL.current, 0);
    curlFingers(fingersR.current, 1.6);

    /* ── ARMS ── */
    const swing = W > 0.01 ? Math.sin(ph + Math.PI) * 0.46 * W : 0;
    const idle = Math.sin(T * 0.9) * 0.035 * (1 - Math.max(s1, s2, s3, s4, s5));

    const poseArm = (sh: THREE.Group | null, el: THREE.Group | null, wr: THREE.Group | null, side: 1 | -1) => {
      if (!sh || !el || !wr) return;
      const k = approach(dt, 6.0);

      // Default: Arms and hands hang 100% vertically straight down alongside the body!
      let targetShZ = side * 0.04;
      let targetShX = swing * side + idle * side;
      let targetShY = 0;
      let targetElX = 0; // ZERO ELBOW BEND! 100% VERTICALLY STRAIGHT!
      let targetElZ = 0;
      let targetWrX = 0;
      let targetWrZ = side * 0.02;

      if (s5 > 0.05) {
        // ── S5: TONY STARK 90-DEGREE FULL ARM EXTENSION ──
        const stark = s5;
        targetShZ = lerp(targetShZ, side * (Math.PI / 2), stark); // 90 degree horizontal stretch
        targetShX = lerp(targetShX, 0, stark);
        targetShY = lerp(targetShY, 0, stark);
        targetElX = lerp(targetElX, 0, stark); // Elbows completely straight
        targetElZ = lerp(targetElZ, 0, stark);
        targetWrX = lerp(targetWrX, -1.45, stark); // Palms cocked back facing forward
        targetWrZ = lerp(targetWrZ, 0, stark);
      }

      sh.rotation.z += (targetShZ - sh.rotation.z) * k;
      sh.rotation.x += (targetShX - sh.rotation.x) * k;
      sh.rotation.y += (targetShY - sh.rotation.y) * k;
      el.rotation.x += (targetElX - el.rotation.x) * k;
      el.rotation.z += (targetElZ - el.rotation.z) * k;
      wr.rotation.x += (targetWrX - wr.rotation.x) * k;
      wr.rotation.z += (targetWrZ - wr.rotation.z) * k;
    };
    poseArm(shL.current, elL.current, wrL.current, -1);
    poseArm(shR.current, elR.current, wrR.current, 1);

    /* ── HALO ── */
    if (halo.current) {
      const on = s3 > 0.12;
      halo.current.visible = on;
      if (on) {
        halo.current.rotation.z += dt * (2.4 + s3 * 2.6);
        halo.current.scale.setScalar(0.9 + Math.sin(T * 6) * 0.07 + s3 * 0.06);
      }
    }

    /* ── publish anchors for the camera ── */
    const pose = poseRef.current;
    const read = (o: THREE.Object3D | null, out: THREE.Vector3) => {
      if (o) o.getWorldPosition(out);
    };
    read(aChest.current, pose.chest);
    read(aHead.current, pose.head);
    read(aCrown.current, pose.crown);
    read(aSole.current, pose.sole);
    read(aPlat.current, pose.platform);
    pose.facing = root.current?.rotation.y ?? 0;
    pose.height = pose.crown.y - pose.platform.y;
  });

  /* ══════════════════════════════════════════════════════════════════════
     GEOMETRY
     ══════════════════════════════════════════════════════════════════════ */
  return (
    <group ref={root} position={[0, -0.38, 0]}>
      {/* ══ STANDING SHEET — one clean plate, nothing else ══ */}
      <group position={[0, GROUND, 0]}>
        <object3D ref={aPlat} />
        <mesh position={[0, -0.03, 0]} receiveShadow>
          <cylinderGeometry args={[1.02, 1.06, 0.06, 72]} />
          <primitive object={M.platformEdge} attach="material" />
        </mesh>
        <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[1.02, 72]} />
          <primitive object={M.platform} attach="material" />
        </mesh>
        {/* floor LED guide rings */}
        <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.74, 0.0035, 8, 72]} />
          <primitive object={M.cyanDim} attach="material" />
        </mesh>
        <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.92, 0.003, 8, 72]} />
          <primitive object={M.cyanDim} attach="material" />
        </mesh>
        {/* ring of strobing platform beacons */}
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return (
            <Blink
              key={`fl${i}`}
              position={[Math.cos(a) * 0.84, 0.008, Math.sin(a) * 0.84]}
              size={0.0055}
              color={i % 2 ? "#31d8ff" : "#00e5ff"}
              rate={1.8 + i * 0.24}
              phase={i * 0.7}
              min={0.04}
              max={4}
            />
          );
        })}
        {shadowTex && (
          <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.6, 1.6]} />
            <meshBasicMaterial map={shadowTex} transparent depthWrite={false} opacity={0.9} />
          </mesh>
        )}
      </group>
      <object3D ref={aSole} position={[0, GROUND, 0]} />

      {/* ══ PELVIS ══ */}
      <group ref={pelvisOffset}>
        <group ref={pelvisYaw}>
          <group ref={pelvisRoll}>
            <mesh castShadow>
              <capsuleGeometry args={[0.145, 0.17, 14, 24]} />
              <primitive object={M.chrome} attach="material" />
            </mesh>
            <mesh position={[0, -0.075, 0.05]} rotation={[0.1, 0, 0]} castShadow>
              <boxGeometry args={[0.28, 0.18, 0.15]} />
              <primitive object={M.ceramic} attach="material" />
            </mesh>
            {[-1, 1].map((sd) => (
              <mesh key={sd} position={[sd * 0.136, 0.01, 0]} rotation={[0, 0, sd * -0.12]} castShadow>
                <sphereGeometry args={[0.09, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
                <primitive object={M.ceramic} attach="material" />
              </mesh>
            ))}
            <HexBolt position={[-0.09, -0.08, 0.13]} mat={M.chrome} />
            <HexBolt position={[0.09, -0.08, 0.13]} mat={M.chrome} />
            <Blink position={[-0.145, 0.018, 0.045]} size={0.007} color="#00e5ff" rate={2.6} phase={0.4} min={0.06} max={5} />
            <Blink position={[0.145, 0.018, 0.045]} size={0.007} color="#00e5ff" rate={2.6} phase={3.4} min={0.06} max={5} />
            <LedStrip a={P.pelvis.from} b={P.pelvis.to} mat={M.cyanDim} />

            {/* ══ LEGS ══ */}
            <Leg side={-1} M={M} onRefs={regL} />
            <Leg side={1} M={M} onRefs={regR} />

            {/* ══ TORSO ══ */}
            <group ref={torso}>
              {/* lumbar */}
              <group position={[0, 0.11, 0]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.108, 0.138, 0.19, 30]} />
                  <primitive object={M.chrome} attach="material" />
                </mesh>
                {[-0.062, -0.018, 0.026, 0.07].map((y, i) => (
                  <mesh key={i} position={[0, y, 0.072]} rotation={[0.06, 0, 0]}>
                    <boxGeometry args={[0.15 - Math.abs(i - 1.5) * 0.014, 0.026, 0.026]} />
                    <primitive object={M.ceramic} attach="material" />
                  </mesh>
                ))}
                <mesh position={[-0.15, 0, 0.02]} rotation={[0, 0, 0.18]} castShadow>
                  <boxGeometry args={[0.044, 0.185, 0.14]} />
                  <primitive object={M.ceramic} attach="material" />
                </mesh>
                <mesh position={[0.15, 0, 0.02]} rotation={[0, 0, -0.18]} castShadow>
                  <boxGeometry args={[0.044, 0.185, 0.14]} />
                  <primitive object={M.ceramic} attach="material" />
                </mesh>
                <mesh position={[0, 0, -0.078]}>
                  <cylinderGeometry args={[0.036, 0.036, 0.2, 14]} />
                  <primitive object={M.dark} attach="material" />
                </mesh>
                {[-0.07, -0.02, 0.03, 0.08].map((y, i) => (
                  <mesh key={`v${i}`} position={[0, y, -0.102]} rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.043, 0.008, 8, 18]} />
                    <primitive object={M.chrome} attach="material" />
                  </mesh>
                ))}
                <LedStrip a={P.waist.from} b={P.waist.to} mat={M.cyanDim} />
              </group>

              {/* chest */}
              <group position={[0, CHEST_Y, 0]}>
                <object3D ref={aChest} />
                <mesh position={[0, 0, -0.05]} castShadow>
                  <boxGeometry args={[0.4, 0.35, 0.21]} />
                  <primitive object={M.chrome} attach="material" />
                </mesh>

                {/* backpack power unit */}
                <group position={[0, 0.01, -0.158]}>
                  <mesh castShadow>
                    <boxGeometry args={[0.31, 0.29, 0.11]} />
                    <primitive object={M.titan} attach="material" />
                  </mesh>
                  <Vents count={5} w={0.24} h={0.014} d={0.04} gap={0.038} mat={M.dark} />
                  <mesh position={[0, 0.115, 0.005]}>
                    <boxGeometry args={[0.2, 0.03, 0.06]} />
                    <primitive object={M.gold} attach="material" />
                  </mesh>
                  <mesh position={[-0.12, -0.06, 0.03]}>
                    <boxGeometry args={[0.035, 0.16, 0.03]} />
                    <primitive object={M.cyanDim} attach="material" />
                  </mesh>
                  <HexBolt position={[-0.13, 0.12, 0.05]} mat={M.chrome} />
                  <HexBolt position={[0.13, 0.12, 0.05]} mat={M.chrome} />
                  <HexBolt position={[-0.13, -0.12, 0.05]} mat={M.chrome} />
                  <HexBolt position={[0.13, -0.12, 0.05]} mat={M.chrome} />
                </group>

                {/* shoulder yoke */}
                <mesh position={[0, 0.152, -0.01]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.03, 0.03, 0.44, 14]} />
                  <primitive object={M.chrome} attach="material" />
                </mesh>
                <mesh position={[0, 0.152, 0.03]} castShadow>
                  <boxGeometry args={[0.3, 0.055, 0.11]} />
                  <primitive object={M.titan} attach="material" />
                </mesh>

                {/* pecs */}
                <mesh position={[-0.117, 0.03, 0.105]} rotation={[0.05, -0.07, 0]} castShadow>
                  <cylinderGeometry args={[0.132, 0.116, 0.235, 30]} />
                  <primitive object={M.ceramic} attach="material" />
                </mesh>
                <mesh position={[0.117, 0.03, 0.105]} rotation={[0.05, 0.07, 0]} castShadow>
                  <cylinderGeometry args={[0.132, 0.116, 0.235, 30]} />
                  <primitive object={M.ceramic} attach="material" />
                </mesh>
                <HexBolt position={[-0.196, 0.132, 0.148]} mat={M.chrome} />
                <HexBolt position={[0.196, 0.132, 0.148]} mat={M.chrome} />
                <HexBolt position={[-0.196, -0.058, 0.148]} mat={M.chrome} />
                <HexBolt position={[0.196, -0.058, 0.148]} mat={M.chrome} />
                <HexBolt position={[-0.196, 0.038, 0.15]} mat={M.gold} />
                <HexBolt position={[0.196, 0.038, 0.15]} mat={M.gold} />
                <mesh position={[0, -0.146, 0.06]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.006, 0.006, 0.24, 8]} />
                  <primitive object={M.dark} attach="material" />
                </mesh>

                {/* sternum + arc reactor */}
                <LedStrip a={P.sternum.from} b={P.sternum.to} mat={M.cyanGlow} />

                {/* flanking power columns — live bus rails either side of the core */}
                {([-1, 1] as const).map((sd) => (
                  <group key={`pwr${sd}`} position={[sd * 0.155, -0.045, 0.124]}>
                    <mesh castShadow>
                      <boxGeometry args={[0.024, 0.17, 0.02]} />
                      <primitive object={M.dark} attach="material" />
                    </mesh>
                    <mesh position={[0, 0, 0.013]}>
                      <boxGeometry args={[0.014, 0.15, 0.012]} />
                      <meshBasicMaterial color="#00e5ff" toneMapped={false} />
                    </mesh>
                    <HexBolt position={[0, 0.098, 0]} mat={M.gold} scale={0.7} />
                    <HexBolt position={[0, -0.098, 0]} mat={M.gold} scale={0.7} />
                  </group>
                ))}

                {/* pectoral chevrons angled toward the reactor */}
                <mesh position={[-0.088, 0.02, 0.148]} rotation={[0, 0.05, 0.55]}>
                  <boxGeometry args={[0.068, 0.05, 0.016]} />
                  <primitive object={M.ceramic} attach="material" />
                </mesh>
                <mesh position={[0.088, 0.02, 0.148]} rotation={[0, -0.05, -0.55]}>
                  <boxGeometry args={[0.068, 0.05, 0.016]} />
                  <primitive object={M.ceramic} attach="material" />
                </mesh>

                {/* arc reactor assembly */}
                <group position={[0, 0.04, 0.14]}>
                  {/* mount rings */}
                  <mesh rotation={[0, 0, Math.PI / 8]}>
                    <cylinderGeometry args={[0.075, 0.075, 0.024, 8]} />
                    <primitive object={M.dark} attach="material" />
                  </mesh>
                  <mesh rotation={[0, 0, Math.PI / 8]}>
                    <cylinderGeometry args={[0.068, 0.068, 0.012, 8]} />
                    <primitive object={M.titan} attach="material" />
                  </mesh>
                  {/* pulsing glow ring */}
                  <mesh ref={coreRing} position={[0, 0, 0.014]}>
                    <torusGeometry args={[0.056, 0.007, 12, 40]} />
                    <primitive object={M.cyanGlow} attach="material" />
                  </mesh>
                  {/* rotating spokes */}
                  <group ref={coreSpokes} position={[0, 0, 0.013]}>
                    <mesh>
                      <boxGeometry args={[0.09, 0.016, 0.005]} />
                      <primitive object={M.cyanGlow} attach="material" />
                    </mesh>
                    <mesh rotation={[0, 0, Math.PI / 2]}>
                      <boxGeometry args={[0.09, 0.016, 0.005]} />
                      <primitive object={M.cyanGlow} attach="material" />
                    </mesh>
                  </group>
                  {/* inner core */}
                  <mesh ref={coreMesh} position={[0, 0, 0.02]}>
                    <cylinderGeometry args={[0.034, 0.034, 0.014, 6]} />
                    <primitive object={M.cyanGlow} attach="material" />
                  </mesh>
                </group>
                <pointLight ref={chestLight} position={[0, 0.04, 0.24]} color="#00e5ff" intensity={1.5} distance={2.1} />
                <Cable a={P.cableL.from} b={P.cableL.to} sag={P.cableL.sag} mat={M.dark} />
                <Cable a={P.cableR.from} b={P.cableR.to} sag={P.cableR.sag} mat={M.dark} />
              </group>

              {/* neck + head */}
              <group position={[0, 0.6, 0]}>
                <mesh position={[0, 0.025, -0.012]} castShadow>
                  <cylinderGeometry args={[0.064, 0.088, 0.13, 28]} />
                  <primitive object={M.dark} attach="material" />
                </mesh>
                <mesh position={[0, 0.028, -0.04]}>
                  <cylinderGeometry args={[0.01, 0.01, 0.11, 10]} />
                  <primitive object={M.chrome} attach="material" />
                </mesh>
                <mesh position={[0, 0.09, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.074, 0.074, 0.008, 30]} />
                  <primitive object={M.gold} attach="material" />
                </mesh>

                <group ref={headGroup} position={[0, HEAD_PIVOT_Y - 0.6, 0.025]}>
                  <object3D ref={aHead} position={[0, 0.04, 0.05]} />
                  <object3D ref={aCrown} position={[0, 0.185, -0.01]} />

                  <group ref={halo} position={[0, 0.135, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
                    <mesh>
                      <ringGeometry args={[0.215, 0.24, 44]} />
                      <primitive object={M.cyanDim} attach="material" />
                    </mesh>
                    <mesh>
                      <ringGeometry args={[0.276, 0.284, 44]} />
                      <primitive object={M.cyanDim} attach="material" />
                    </mesh>
                  </group>

                  {/* skull */}
                  <mesh position={[0, 0.034, -0.02]} castShadow>
                    <sphereGeometry args={[0.142, 44, 30]} />
                    <primitive object={M.ceramic} attach="material" />
                  </mesh>
                  <mesh position={[0, 0.157, -0.012]}>
                    <boxGeometry args={[0.016, 0.03, 0.042]} />
                    <primitive object={M.chrome} attach="material" />
                  </mesh>
                  <HexBolt position={[-0.062, 0.17, -0.006]} rotation={[-Math.PI / 2, 0, 0]} scale={0.8} mat={M.gold} />
                  <HexBolt position={[0.062, 0.17, -0.006]} rotation={[-Math.PI / 2, 0, 0]} scale={0.8} mat={M.gold} />
                  <HexBolt position={[0, 0.17, 0.056]} rotation={[-Math.PI / 2, 0, 0]} scale={0.8} mat={M.chrome} />

                  {/* face plate — sits high on the skull so it reads as a brow
                      cowl. The eyes sit below and outside it rather than behind
                      it, which is what used to bury them. */}
                  <mesh position={[0, 0.078, 0.042]} rotation={[-0.22, 0, 0]} castShadow>
                    <sphereGeometry args={[0.132, 44, 26, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
                    <primitive object={M.face} attach="material" />
                  </mesh>
                  {[-1, 1].map((sd) => (
                    <group key={sd} position={[sd * 0.121, 0.03, 0.055]} rotation={[0, -sd * 0.42, 0]}>
                      <Vents count={3} w={0.03} h={0.009} d={0.014} gap={0.016} mat={M.dark} />
                    </group>
                  ))}

                  {/* brows */}
                  {([-1, 1] as const).map((sd) => (
                    <group
                      key={sd}
                      ref={sd < 0 ? browL : browR}
                      position={[sd * EYE_X, 0.084, 0.121]}
                      rotation={[0.2, -sd * 0.12, -sd * 0.06]}
                    >
                      <mesh>
                        <boxGeometry args={[0.056, 0.014, 0.016]} />
                        <primitive object={M.dark} attach="material" />
                      </mesh>
                      <mesh position={[0, 0.012, -0.004]}>
                        <boxGeometry args={[0.05, 0.007, 0.01]} />
                        <primitive object={M.titan} attach="material" />
                      </mesh>
                    </group>
                  ))}

                  {/* nose bridge */}
                  <mesh position={[0, 0.024, 0.14]} rotation={[0.18, 0, 0]}>
                    <boxGeometry args={[0.019, 0.052, 0.022]} />
                    <primitive object={M.face} attach="material" />
                  </mesh>

                  {/* ══ EYES ══ */}
                  <group position={[-EYE_X, EYE_Y, EYE_Z]}>
                    <Eye
                      tilt={-0.1}
                      M={M}
                      gazeRef={gazeL}
                      upperRef={lidUL}
                      lowerRef={lidLL}
                      pupilRef={pupL}
                      irisRef={irisMat}
                    />
                    <pointLight ref={eyeLightL} position={[0, 0, 0.055]} color="#00e5ff" intensity={1} distance={0.85} />
                  </group>
                  <group position={[EYE_X, EYE_Y, EYE_Z]}>
                    <Eye tilt={0.1} M={M} gazeRef={gazeR} upperRef={lidUR} lowerRef={lidLR} pupilRef={pupR} />
                    <pointLight ref={eyeLightR} position={[0, 0, 0.055]} color="#00e5ff" intensity={1} distance={0.85} />
                  </group>

                  {/* mouth */}
                  <group position={[0, -0.036, 0.13]}>
                    <mesh ref={mouth} scale={[1, 0.35, 1]}>
                      <boxGeometry args={[0.056, 0.01, 0.012]} />
                      <meshStandardMaterial
                        ref={mouthMat}
                        color="#0a0e14"
                        emissive="#00e5ff"
                        emissiveIntensity={1.2}
                        roughness={0.3}
                      />
                    </mesh>
                    <LedStrip a={P.mouthGlow.from} b={P.mouthGlow.to} mat={M.cyanDim} />
                  </group>

                  {/* chin + jaw */}
                  <mesh position={[0, -0.092, 0.07]} rotation={[-0.18, 0, 0]} castShadow>
                    <boxGeometry args={[0.074, 0.044, 0.046]} />
                    <primitive object={M.face} attach="material" />
                  </mesh>
                  <mesh position={[-0.062, -0.075, 0.062]} rotation={[0, 0.3, 0.2]} castShadow>
                    <boxGeometry args={[0.032, 0.04, 0.036]} />
                    <primitive object={M.ceramic} attach="material" />
                  </mesh>
                  <mesh position={[0.062, -0.075, 0.062]} rotation={[0, -0.3, -0.2]} castShadow>
                    <boxGeometry args={[0.032, 0.04, 0.036]} />
                    <primitive object={M.ceramic} attach="material" />
                  </mesh>
                  <HexBolt position={[0, -0.096, 0.1]} scale={0.7} mat={M.chrome} />

                  {/* cheek plates */}
                  <mesh position={[-0.11, 0.02, 0.08]} rotation={[0, 0.3, 0]}>
                    <boxGeometry args={[0.04, 0.046, 0.03]} />
                    <primitive object={M.ceramic} attach="material" />
                  </mesh>
                  <mesh position={[0.11, 0.02, 0.08]} rotation={[0, -0.3, 0]}>
                    <boxGeometry args={[0.04, 0.046, 0.03]} />
                    <primitive object={M.ceramic} attach="material" />
                  </mesh>
                  <HexBolt position={[-0.13, 0.03, 0.072]} rotation={[0, Math.PI / 2, 0]} scale={0.65} mat={M.gold} />
                  <HexBolt position={[0.13, 0.03, 0.072]} rotation={[0, -Math.PI / 2, 0]} scale={0.65} mat={M.gold} />

                  {/* ear pods */}
                  {[-1, 1].map((sd) => (
                    <group key={sd} position={[sd * 0.138, 0.024, -0.008]}>
                      <mesh rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.031, 0.031, 0.026, 22]} />
                        <primitive object={M.chrome} attach="material" />
                      </mesh>
                      <mesh rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.016, 0.016, 0.032, 12]} />
                        <primitive object={M.dark} attach="material" />
                      </mesh>
                      <HexBolt position={[sd * 0.016, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={0.75} mat={M.gold} />
                      <Blink position={[sd * 0.015, 0.015, 0]} size={0.0055} color="#00e5ff" rate={4} phase={sd * 1.2} min={0.05} max={5.5} />
                    </group>
                  ))}
                </group>
              </group>

              {/* ══ ARMS ══ */}
              {([-1, 1] as const).map((sd) => (
                <group key={sd} position={[sd * SHOULDER_X, SHOULDER_Y, 0]}>
                  <mesh>
                    <sphereGeometry args={[0.084, 30, 28]} />
                    <primitive object={M.chrome} attach="material" />
                  </mesh>
                  <mesh position={[sd * 0.022, 0.034, 0]} rotation={[0, 0, -sd * 0.18]} castShadow>
                    <sphereGeometry args={[0.1, 30, 22, 0, Math.PI * 2, 0, Math.PI * 0.56]} />
                    <primitive object={M.ceramic} attach="material" />
                  </mesh>
                  <mesh position={[sd * 0.056, 0.058, 0.012]} rotation={[0.1, 0, -sd * 0.3]} castShadow>
                    <boxGeometry args={[0.05, 0.062, 0.13]} />
                    <primitive object={M.titan} attach="material" />
                  </mesh>
                  <mesh position={[sd * 0.01, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.094, 0.094, 0.01, 30]} />
                    <primitive object={M.gold} attach="material" />
                  </mesh>
                  <HexBolt position={[sd * 0.094, 0.044, 0]} rotation={[0, 0, Math.PI / 2]} mat={M.gold} />
                  <HexBolt position={[sd * 0.046, 0.094, 0.026]} mat={M.chrome} />
                  <Blink position={[sd * 0.012, 0.076, 0.052]} size={0.007} color="#00e5ff" rate={2.4} phase={-sd * 1.4} min={0.06} max={5.5} />
                  <Blink position={[sd * 0.02, 0.012, 0.078]} size={0.006} color="#31d8ff" rate={4.6} phase={2 + sd} min={0.05} max={4.5} />
                  <LedStrip a={sd < 0 ? P.armL.from : P.armR.from} b={sd < 0 ? P.armL.to : P.armR.to} mat={M.cyanDim} />

                  <group ref={sd < 0 ? shL : shR}>
                    <mesh position={[sd * 0.02, -0.17, 0.012]} castShadow>
                      <cylinderGeometry args={[0.059, 0.048, 0.26, 28]} />
                      <primitive object={M.ceramic} attach="material" />
                    </mesh>
                    <mesh position={[sd * 0.02, -0.17, -0.024]}>
                      <cylinderGeometry args={[0.034, 0.034, 0.23, 14]} />
                      <primitive object={M.chrome} attach="material" />
                    </mesh>
                    <mesh position={[sd * 0.05, -0.17, 0.014]} rotation={[0, -sd * 0.16, 0]} castShadow>
                      <boxGeometry args={[0.026, 0.22, 0.07]} />
                      <primitive object={M.titan} attach="material" />
                    </mesh>
                    <LedStrip a={sd < 0 ? P.bicepL.from : P.bicepR.from} b={sd < 0 ? P.bicepL.to : P.bicepR.to} mat={M.cyanDim} />

                    <group ref={sd < 0 ? elL : elR} position={[sd * 0.02, -0.3, 0]}>
                      <mesh rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.049, 0.049, 0.098, 28]} />
                        <primitive object={M.chrome} attach="material" />
                      </mesh>
                      <mesh position={[0, 0, 0.04]}>
                        <sphereGeometry args={[0.029, 16, 16]} />
                        <primitive object={M.ceramic} attach="material" />
                      </mesh>
                      <mesh rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.061, 0.061, 0.006, 28]} />
                        <primitive object={M.gold} attach="material" />
                      </mesh>
                      <HexBolt position={[-sd * 0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]} mat={M.gold} />
                      <mesh position={[0, -0.145, 0]} castShadow>
                        <cylinderGeometry args={[0.049, 0.038, 0.24, 28]} />
                        <primitive object={M.ceramic} attach="material" />
                      </mesh>
                      <mesh position={[0, -0.145, 0.043]}>
                        <boxGeometry args={[0.009, 0.18, 0.009]} />
                        <primitive object={M.cyanGlow} attach="material" />
                      </mesh>
                      <mesh position={[sd * 0.036, -0.14, 0.008]} rotation={[0, -sd * 0.12, 0]}>
                        <boxGeometry args={[0.022, 0.16, 0.05]} />
                        <primitive object={M.titan} attach="material" />
                      </mesh>

                      <group ref={sd < 0 ? wrL : wrR} position={[0, -0.272, 0]}>
                        <mesh rotation={[0, 0, Math.PI / 2]}>
                          <cylinderGeometry args={[0.035, 0.035, 0.062, 22]} />
                          <primitive object={M.chrome} attach="material" />
                        </mesh>
                        <Hand joints={sd < 0 ? fingersL : fingersR} M={M} />
                      </group>
                    </group>
                  </group>
                </group>
              ))}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
