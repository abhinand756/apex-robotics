"use client";

import { memo, useCallback, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { RealisticHumanoid, makeRobotPose, type RobotPose } from "./RealisticHumanoid";

/* ══════════════════════════════════════════════════════════════════════════
   SHOT LIST
   Each shot is a spherical rig relative to a point interpolated between the
   platform and the crown, so the camera always frames the live pose no matter
   how the robot moves.

     focus  0 = feet / platform, 1 = top of head
     span   required visible height (world units) at the subject plane
     fov    long-lens compression
     azim   azimuth in radians (+ = camera to the subject's left)
     elev   camera height above the focus point
     mul    distance multiplier on top of the auto-fit distance
     roll   camera roll in degrees
   ══════════════════════════════════════════════════════════════════════════ */
interface Shot {
  at: number;
  focus: number;
  span: number;
  fov: number;
  azim: number;
  elev: number;
  mul: number;
  roll: number;
  /** animated in-shot variation */
  driftAzim: number;
  driftElev: number;
  pushIn: number;
  sway: number;
}

const SHOTS: Shot[] = [
  // A — idle: slow breathing orbit, three-quarter, full figure planted
  { at: 0.0, focus: 0.5, span: 2.62, fov: 27, azim: 0.32, elev: 0.22, mul: 1.0, roll: -0.8, driftAzim: 0.4, driftElev: 0.06, pushIn: 0.09, sway: 0.05 },
  // B — arrival: low hero, whole body
  { at: 0.11, focus: 0.5, span: 2.64, fov: 26, azim: -0.3, elev: -0.04, mul: 0.98, roll: 0.6, driftAzim: -0.1, driftElev: 0.12, pushIn: 0.06, sway: 0.02 },
  // C — present: step 2 (wider framing — more body visible)
  { at: 0.3, focus: 0.65, span: 2.55, fov: 26, azim: 0.2, elev: 0.1, mul: 1.0, roll: 0.0, driftAzim: 0.12, driftElev: 0.04, pushIn: 0.06, sway: 0.03 },
  // D — cortex: step 3 (wider framing — more body visible)
  { at: 0.5, focus: 0.72, span: 2.25, fov: 26, azim: -0.2, elev: 0.05, mul: 1.0, roll: 0.0, driftAzim: 0.12, driftElev: 0.02, pushIn: 0.06, sway: 0.02 },
  // E — dynamics: low, wide, braced
  { at: 0.7, focus: 0.5, span: 2.72, fov: 36, azim: 0.22, elev: -0.6, mul: 1.0, roll: -2.2, driftAzim: -0.14, driftElev: 0.1, pushIn: 0.05, sway: 0.06 },
  // F — certified: rising hero front shot to frame the 90-degree Tony Stark pose
  { at: 0.9, focus: 0.58, span: 2.75, fov: 28, azim: 0.0, elev: 0.08, mul: 1.0, roll: 0.0, driftAzim: 0.0, driftElev: 0.02, pushIn: 0.08, sway: 0.02 },
  // G — exit: settle back to a full figure
  { at: 1.0, focus: 0.55, span: 2.56, fov: 27, azim: 0.34, elev: 0.16, mul: 1.0, roll: -0.5, driftAzim: 0.12, driftElev: 0.08, pushIn: 0.05, sway: 0.04 },
];

const D2R = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Sample the shot list at pHero — smooth, continuous, no hard cuts. */
function sampleShots(p: number, out: Shot) {
  const n = SHOTS.length;
  let i = 0;
  while (i < n - 2 && p > SHOTS[i + 1].at) i++;
  const a = SHOTS[i];
  const b = SHOTS[i + 1];
  const span = Math.max(1e-4, b.at - a.at);
  const u = smoothstep(0, 1, clamp((p - a.at) / span, 0, 1));
  out.focus = lerp(a.focus, b.focus, u);
  out.span = lerp(a.span, b.span, u);
  out.fov = lerp(a.fov, b.fov, u);
  out.azim = lerp(a.azim, b.azim, u) + lerp(a.driftAzim, b.driftAzim, u) * u;
  out.elev = lerp(a.elev, b.elev, u) + lerp(a.driftElev, b.driftElev, u) * u;
  out.mul = lerp(a.mul, b.mul, u);
  out.roll = lerp(a.roll, b.roll, u);
  out.driftAzim = 0;
  out.driftElev = 0;
  out.pushIn = lerp(a.pushIn, b.pushIn, u);
  out.sway = lerp(a.sway, b.sway, u);
  return out;
}

/** Critically damped spring — smooth, no overshoot, frame-rate independent. */
class Spring {
  v = 0;
  constructor(public x = 0, public rate = 4) {}
  step(target: number, dt: number) {
    const k = this.rate;
    this.v += (-2 * k * this.v - k * k * (this.x - target)) * dt;
    this.x += this.v * dt;
    return this.x;
  }
  snap(t: number) {
    this.x = t;
    this.v = 0;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   CINEMATIC CAMERA
   ══════════════════════════════════════════════════════════════════════════ */
function CinematicCamera({ progress, poseRef, orbitActive }: { progress: React.RefObject<number>; poseRef: React.RefObject<RobotPose>; orbitActive: boolean }) {
  const S = useRef({
    shot: { ...SHOTS[0] } as Shot,
    pos: [new Spring(0, 3.1), new Spring(0, 3.1), new Spring(0, 3.1)],
    look: [new Spring(0, 4.4), new Spring(0, 4.4), new Spring(0, 4.4)],
    fov: new Spring(27, 3.4),
    roll: new Spring(0, 2.6),
    focus: new THREE.Vector3(),
    lookAt: new THREE.Vector3(),
    lookVel: new THREE.Vector3(),
    prevFocus: new THREE.Vector3(),
    want: new THREE.Vector3(),
    tmp: new THREE.Vector3(),
    camPos: new THREE.Vector3(),
    camLook: new THREE.Vector3(),
    up: new THREE.Vector3(0, 1, 0),
    seeded: false,
    idle: 0,
  }).current;

  useFrame((state, rawDelta) => {
    if (orbitActive) return;
    const dt = Math.min(rawDelta, 1 / 25);
    const p = clamp(progress.current ?? 0, 0, 1);
    const T = state.clock.elapsedTime;
    const shot = sampleShots(p, S.shot);

    const { platform: plat, crown, head, chest } = poseRef.current;

    /* focus point: platform → crown, easing fully onto the skull for close-ups
       so tight shots centre the face (all three axes), not just the body */
    const faceT = smoothstep(0.72, 1, shot.focus);
    const fy = lerp(lerp(plat.y, crown.y, shot.focus), head.y, faceT);
    S.focus.set(lerp(chest.x, head.x, faceT), fy, lerp(chest.z, head.z, faceT));

    /* auto-fit distance so `span` is exactly visible at the subject plane.
       Full-body shots additionally clear the live crown→platform extent measured
       from the *current* focus point, so head and feet can never clip even as
       the pose animates. The 1.06 headroom also absorbs the handheld shake. */
    const halfExtent = Math.max(crown.y - fy, fy - plat.y);
    const fullBody = 1 - smoothstep(0.5, 0.72, shot.focus);
    const span = Math.max(shot.span, halfExtent * 2 * 1.06 * fullBody);
    const fit = (span / (2 * Math.tan(shot.fov * 0.5 * D2R))) * shot.mul;
    const dolly = fit * (1 - shot.pushIn * 0.14);

    /* idle drift: slow orbit while parked at the top of the page */
    const idle = p < 0.02 ? 1 : 0;
    S.idle = idle;
    const idleAzim = idle * Math.sin(T * 0.16) * 0.5;
    const idleElev = idle * (Math.sin(T * 0.11) * 0.06 + 0.06);
    const idleMul = idle * (0.5 - 0.5 * Math.cos(T * 0.16)) * 0.09;

    const azim = shot.azim + idleAzim;
    const dist = dolly * (1 - idleMul);
    const ca = Math.cos(azim);
    const sa = Math.sin(azim);

    /* handheld micro-motion — two slow octaves, very low amplitude */
    const hx = (Math.sin(T * 1.7) * 0.6 + Math.sin(T * 4.3 + 1.1) * 0.4) * 0.006 + Math.sin(T * 0.9) * 0.012;
    const hy = (Math.cos(T * 1.4) * 0.6 + Math.cos(T * 3.7 + 2.3) * 0.4) * 0.005 + Math.sin(T * 1.1) * 0.01;
    const hz = Math.sin(T * 1.9 + 0.7) * 0.008;

    S.want.set(
      S.focus.x + sa * dist + hx,
      S.focus.y + shot.elev + idleElev + hy,
      S.focus.z + ca * dist + hz
    );

    /* aim: lead the subject by its own motion, like a real operator */
    S.lookAt.copy(S.focus);
    if (S.seeded) {
      S.lookVel.subVectors(S.focus, S.prevFocus).divideScalar(Math.max(dt, 1e-4));
      const lead = 0.055;
      S.lookAt.x += clamp(S.lookVel.x * lead, -0.16, 0.16);
      S.lookAt.y += clamp(S.lookVel.y * lead, -0.1, 0.1);
    }
    S.lookAt.x += Math.sin(T * 0.5) * shot.sway * 0.05;
    S.prevFocus.copy(S.focus);
    S.seeded = true;

    const cam = state.camera as THREE.PerspectiveCamera;
    for (let i = 0; i < 3; i++) {
      S.camPos.setComponent(i, S.pos[i].step(S.want.getComponent(i), dt));
      S.camLook.setComponent(i, S.look[i].step(S.lookAt.getComponent(i), dt));
    }
    const fov = S.fov.step(shot.fov, dt);
    const roll = S.roll.step(shot.roll * D2R, dt);

    cam.position.copy(S.camPos);
    /* roll: tilt the up-vector perpendicular to the view direction */
    S.tmp.subVectors(S.camLook, S.camPos).normalize();
    S.up.set(Math.sin(roll), Math.cos(roll), 0);
    /* project the tilt onto the plane perpendicular to the view axis */
    const d = S.tmp.dot(S.up);
    S.up.addScaledVector(S.tmp, -d).normalize();
    cam.up.copy(S.up);
    cam.lookAt(S.camLook);
    if (Math.abs(cam.fov - fov) > 0.005) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  });

  return null;
}

/* ══════════════════════════════════════════════════════════════════════════
   STAGE LIGHTS
   ══════════════════════════════════════════════════════════════════════════ */
function StageLights({ progress }: { progress: React.RefObject<number> }) {
  const rimL = useRef<THREE.DirectionalLight>(null);
  const rimR = useRef<THREE.DirectionalLight>(null);
  const top = useRef<THREE.SpotLight>(null);
  const under = useRef<THREE.PointLight>(null);
  const face = useRef<THREE.SpotLight>(null);
  const col = useMemo(() => new THREE.Color(), []);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 25);
    const T = state.clock.elapsedTime;
    const p = progress.current ?? 0;
    const breathe = 1 + Math.sin(T * 1.5) * 0.09;

    const palette = ["#00e5ff", "#31d8ff", "#8f7bff", "#25ffab", "#ffdf6b", "#00e5ff", "#31d8ff"];
    const power = [3.0, 3.4, 4.4, 2.8, 3.8, 3.0, 3.4];
    let i = 0;
    while (i < palette.length - 2 && p > SHOTS[i + 1].at) i++;
    const j = i + 1;
    const u = smoothstep(0, 1, clamp((p - SHOTS[i].at) / Math.max(1e-4, SHOTS[j].at - SHOTS[i].at), 0, 1));
    col.set(palette[i]).lerp(new THREE.Color(palette[j]), u);
    const inten = lerp(power[i], power[j], u);

    const k = 1 - Math.exp(-dt * 3);
    if (rimL.current) {
      rimL.current.color.lerp(col, k);
      rimL.current.intensity += (inten * breathe - rimL.current.intensity) * k;
    }
    if (rimR.current) {
      rimR.current.color.lerp(col, k);
      rimR.current.intensity += (inten * 0.32 * breathe - rimR.current.intensity) * k;
    }
    if (under.current) {
      under.current.color.lerp(col, k);
      const t = 0.3 + Math.sin(T * 2.3) * 0.12;
      under.current.intensity += (t - under.current.intensity) * k;
    }
    if (top.current) {
      const t = 2.8 + (i === 4 || i === 5 ? 1.0 : 0);
      top.current.intensity += (t - top.current.intensity) * (1 - Math.exp(-dt * 2));
    }
    /* key light on the face for the close-up */
    if (face.current) {
      const closeness = Math.max(0, 1 - Math.abs(p - 0.5) / 0.17);
      face.current.intensity += (closeness * 1.6 - face.current.intensity) * (1 - Math.exp(-dt * 4));
    }
  });

  return (
    <>
      <spotLight ref={top} position={[0, 5, 2.5]} angle={0.4} penumbra={0.45} intensity={2.8} distance={9} color="#ffffff" castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[2.6, 4, 3]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0001} />
      <directionalLight position={[2, -0.6, 2]} intensity={0.3} color="#ffd0a0" />
      <directionalLight ref={rimL} position={[-3.6, 2.4, -1.8]} intensity={3} color="#00e5ff" />
      <directionalLight ref={rimR} position={[3.6, 1.8, -1.8]} intensity={1.5} color="#00e5ff" />
      <pointLight ref={under} position={[0, -1, 0.7]} color="#00e5ff" intensity={0.3} distance={3} />
      <directionalLight position={[0, 0.8, -3.2]} intensity={0.3} color="#00b8ff" />
      {/* dedicated face key — only during the close-up */}
      <spotLight ref={face} position={[0.5, 1.9, 2.2]} angle={0.34} penumbra={0.7} intensity={0} distance={6} color="#eaf6ff" />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CANVAS
   ══════════════════════════════════════════════════════════════════════════ */
function HumanoidScene({
  progress,
  interactiveOrbit,
}: {
  progress: React.RefObject<number>;
  interactiveOrbit: boolean;
}) {
  const poseRef = useRef<RobotPose>(makeRobotPose());
  return (
    <>
      <CinematicCamera progress={progress} poseRef={poseRef} orbitActive={interactiveOrbit} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={["#d0e8ff", "#030508", 0.45]} />
      <StageLights progress={progress} />
      <RealisticHumanoid progress={progress} poseRef={poseRef} />
      <Environment preset="studio" environmentIntensity={0.5} />
      {interactiveOrbit && (
        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={0.6}
          maxDistance={6}
          minPolarAngle={Math.PI / 7}
          maxPolarAngle={Math.PI / 1.75}
          target={[0, -0.3, 0]}
        />
      )}
    </>
  );
}

export const HumanoidCanvas = memo(function HumanoidCanvas({
  progress,
  interactiveOrbit = false,
}: {
  progress: React.RefObject<number>;
  interactiveOrbit?: boolean;
}) {
  const onCreated = useCallback((st: { gl: { toneMappingExposure: number } }) => {
      st.gl.toneMappingExposure = 1;
    }, []);

  return (
    <Canvas
      shadows
      onCreated={onCreated}
      camera={{ position: [0, 0.4, 3.6], fov: 27 }}
      style={{ position: "absolute", inset: 0, pointerEvents: interactiveOrbit ? "auto" : "none" }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      dpr={[1, 2]}
    >
      <HumanoidScene
        progress={progress}
        interactiveOrbit={interactiveOrbit}
      />
    </Canvas>
  );
});
