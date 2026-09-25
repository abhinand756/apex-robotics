"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clamp01, easeInOutCubic } from "@/lib/animate";
import { T } from "@/lib/timeline";

interface RobotModelProps {
  p: number;
  ms: number;
  xrayMode?: boolean;
  explodedMode?: boolean;
  overdriveMode?: boolean;
  orbitActive?: boolean;
}

function stageProgress(p: number, from: number, to: number) {
  return easeInOutCubic(clamp01((p - from) / (to - from)));
}

export function RobotModel({
  p,
  ms,
  xrayMode = false,
  explodedMode = false,
  overdriveMode = false,
  orbitActive = false,
}: RobotModelProps) {
  // double-click actions in 360° mode — legs walk toggle, chest stays until next double-click
  const [handWave, setHandWave] = useState(false);
  const [legWalk, setLegWalk] = useState(false);
  const [headNod, setHeadNod] = useState(false);
  const [chestBurst, setChestBurst] = useState(false);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const group = useRef<THREE.Group>(null);
  const headGroup = useRef<THREE.Group>(null);
  const leftArmGroup = useRef<THREE.Group>(null);
  const rightArmGroup = useRef<THREE.Group>(null);
  const legsGroupRef = useRef<THREE.Group>(null);
  const cranialCapRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const chestLightRef = useRef<THREE.PointLight>(null);

  const onHandDouble = (e: any) => {
    if (!orbitActive) return;
    e.stopPropagation();
    setHandWave((v) => !v);
  };
  // auto-stop hand wave when 360 turned off
  useEffect(() => {
    if (!orbitActive) {
      setHandWave(false);
      setLegWalk(false);
      setHeadNod(false);
    }
  }, [orbitActive]);
  const onLegDouble = (e: any) => {
    if (!orbitActive) return;
    e.stopPropagation();
    setLegWalk((v) => !v);
  };
  const onHeadDouble = (e: any) => {
    if (!orbitActive) return;
    e.stopPropagation();
    setHeadNod(true);
    setTimeout(() => setHeadNod(false), 900);
  };
  const onChestDouble = (e: any) => {
    if (!orbitActive) return;
    e.stopPropagation();
    setChestBurst((v) => !v);
  };

  // Mouse tracking vector
  const mouseTarget = useRef(new THREE.Vector2(0, 0));
  const mouseCurrent = useRef(new THREE.Vector2(0, 0));

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseTarget.current.set(nx, ny);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Material setup
  const mats = useMemo(() => {
    const armor = new THREE.MeshStandardMaterial({
      color: "#121b27",
      roughness: 0.28,
      metalness: 0.82,
      transparent: xrayMode,
      opacity: xrayMode ? 0.28 : 1.0,
      wireframe: xrayMode,
    });
    const armorDark = new THREE.MeshStandardMaterial({
      color: "#0a1017",
      roughness: 0.38,
      metalness: 0.75,
      transparent: xrayMode,
      opacity: xrayMode ? 0.35 : 1.0,
    });
    const titanium = new THREE.MeshStandardMaterial({
      color: "#223145",
      roughness: 0.22,
      metalness: 0.9,
    });
    const goldJoint = new THREE.MeshStandardMaterial({
      color: "#d4af37",
      roughness: 0.15,
      metalness: 0.95,
    });
    const chrome = new THREE.MeshStandardMaterial({
      color: "#f0f8ff",
      roughness: 0.05,
      metalness: 0.98,
    });
    const visor = new THREE.MeshStandardMaterial({
      color: "#05090f",
      roughness: 0.1,
      metalness: 0.95,
    });
    const eye = new THREE.MeshStandardMaterial({
      color: overdriveMode ? "#ff3355" : "#00e5ff",
      emissive: overdriveMode ? "#ff0033" : "#00e5ff",
      emissiveIntensity: 1.15,
      roughness: 0.35,
    });
    const core = new THREE.MeshStandardMaterial({
      color: "#eaf6ff",
      emissive: overdriveMode ? "#ff5500" : "#00e5ff",
      emissiveIntensity: 2.2,
      roughness: 0.1,
    });
    const conduit = new THREE.MeshStandardMaterial({
      color: overdriveMode ? "#ff8800" : "#00e5ff",
      emissive: overdriveMode ? "#ff4400" : "#00e5ff",
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });

    return { armor, armorDark, titanium, goldJoint, chrome, visor, eye, core, conduit };
  }, [xrayMode, overdriveMode]);

  // Clean sequential assembly progression matching UI build stages
  const vis = {
    pelvisAndSpine: 1.0, // Base structural frame is always docked in the bay
    legs: stageProgress(p, 0.15, 0.21),
    torso: stageProgress(p, 0.21, 0.28),
    arms: stageProgress(p, 0.28, 0.34),
    core: stageProgress(p, 0.34, 0.38),
    head: stageProgress(p, 0.37, 0.41),
  };

  const isAIPhase = p >= 0.40 && p <= 0.62;
  const isTestingPhase = p >= 0.77 && p <= 0.895;
  const isActivationPhase = p >= 0.90;

  // Exploded CAD offset multiplier
  const exp = explodedMode ? 0.35 : 0;

  useFrame((_, delta) => {
    const t = ms * 0.001;

    // Smooth mouse tracking
    mouseCurrent.current.lerp(mouseTarget.current, delta * 3.5);

    if (group.current) {
      // Natural cybernetic breathing & idle float — slightly lower in 360° mode
      const breath = Math.sin(t * 1.4) * 0.012;
      const bob = Math.cos(t * 0.9) * 0.015 * (vis.torso > 0.8 ? 1 : 0);
      const baseY = orbitActive ? -0.34 : -0.2;
      group.current.position.y = baseY + bob + breath;

      // In finished activation phase: subtle interactive torso tilt tracking cursor
      if (isActivationPhase) {
        group.current.rotation.y = THREE.MathUtils.lerp(
          group.current.rotation.y,
          mouseCurrent.current.x * 0.25,
          delta * 2.5
        );
        group.current.rotation.x = THREE.MathUtils.lerp(
          group.current.rotation.x,
          -mouseCurrent.current.y * 0.1,
          delta * 2.5
        );
      } else {
        group.current.rotation.y = Math.sin(t * 0.5) * 0.04;
        group.current.rotation.x = 0;
      }
    }

    // Head kinematics & self-awareness
    if (headGroup.current) {
      if (isActivationPhase) {
        headGroup.current.rotation.y = THREE.MathUtils.lerp(
          headGroup.current.rotation.y,
          mouseCurrent.current.x * 0.55,
          delta * 4.0
        );
        headGroup.current.rotation.x = THREE.MathUtils.lerp(
          headGroup.current.rotation.x,
          -mouseCurrent.current.y * 0.35,
          delta * 4.0
        );
      } else if (isAIPhase) {
        headGroup.current.rotation.x = 0.22 + Math.sin(t * 0.8) * 0.05;
        headGroup.current.rotation.y = Math.sin(t * 1.1) * 0.2;
      } else if (isTestingPhase) {
        headGroup.current.rotation.y = Math.sin(t * 2.2) * 0.3;
        headGroup.current.rotation.x = Math.cos(t * 1.6) * 0.1;
      } else {
        headGroup.current.rotation.y = Math.sin(t * 0.7) * 0.06;
        headGroup.current.rotation.x = 0;
      }
    }

    // Cranial inspection lid opens during AI Brain phase or X-Ray mode
    if (cranialCapRef.current) {
      const openTarget = (isAIPhase || xrayMode) ? 0.16 : 0;
      cranialCapRef.current.position.y = THREE.MathUtils.lerp(
        cranialCapRef.current.position.y,
        openTarget,
        delta * 3.0
      );
    }

    // Core spin
    if (coreRef.current) {
      coreRef.current.rotation.z += delta * (overdriveMode ? 4.5 : 1.2);
    }

    // Eye blink — only after production complete (activation p>=0.90), horizontal lid
    if (isActivationPhase) {
      const blinkInterval = 3.4;
      const blinkDuration = 0.14;
      const blinkPhase = t % blinkInterval;
      const isBlinking = blinkPhase > blinkInterval - blinkDuration;
      const targetY = isBlinking ? 0.10 : 1;
      if (leftEyeRef.current) {
        leftEyeRef.current.scale.set(1, THREE.MathUtils.lerp(leftEyeRef.current.scale.y, targetY, delta * 24), 1);
        leftEyeRef.current.visible = true;
      }
      if (rightEyeRef.current) {
        rightEyeRef.current.scale.set(1, THREE.MathUtils.lerp(rightEyeRef.current.scale.y, targetY, delta * 24), 1);
        rightEyeRef.current.visible = true;
      }
    } else {
      // before completion — eyes open, no blink
      if (leftEyeRef.current) leftEyeRef.current.scale.set(1, 1, 1);
      if (rightEyeRef.current) rightEyeRef.current.scale.set(1, 1, 1);
    }

    // Chest power core — interval pulse, but stays on if chest double-click toggled
    if (chestBurst && orbitActive) {
      // keep high — handled in burst override below, skip pulse
    } else {
      const chestInterval = 2.8;
      const chestPulseDur = 0.45;
      const chestPhase = t % chestInterval;
      const chestOn = chestPhase < chestPulseDur;
      if (chestLightRef.current) {
        const targetInt = chestOn ? (overdriveMode ? 5.5 : 3.2) : overdriveMode ? 2.2 : 0.9;
        chestLightRef.current.intensity = THREE.MathUtils.lerp(chestLightRef.current.intensity, targetInt, delta * 6);
      }
    }

    // Arm gestures — only when 360° inspect is on (user request)
    if (leftArmGroup.current && rightArmGroup.current) {
      if (!orbitActive) {
        leftArmGroup.current.rotation.x = THREE.MathUtils.lerp(leftArmGroup.current.rotation.x, 0, delta * 4);
        leftArmGroup.current.rotation.z = THREE.MathUtils.lerp(leftArmGroup.current.rotation.z, 0.08, delta * 4);
        rightArmGroup.current.rotation.x = THREE.MathUtils.lerp(rightArmGroup.current.rotation.x, 0, delta * 4);
        rightArmGroup.current.rotation.z = THREE.MathUtils.lerp(rightArmGroup.current.rotation.z, -0.08, delta * 4);
      } else if (isAIPhase) {
        leftArmGroup.current.rotation.x = THREE.MathUtils.lerp(leftArmGroup.current.rotation.x, -0.8, delta * 3.0);
        leftArmGroup.current.rotation.z = THREE.MathUtils.lerp(leftArmGroup.current.rotation.z, 0.4, delta * 3.0);
        rightArmGroup.current.rotation.x = THREE.MathUtils.lerp(rightArmGroup.current.rotation.x, -0.8, delta * 3.0);
        rightArmGroup.current.rotation.z = THREE.MathUtils.lerp(rightArmGroup.current.rotation.z, -0.4, delta * 3.0);
      } else if (isTestingPhase) {
        const cycle = Math.sin(t * 2.0);
        leftArmGroup.current.rotation.x = -0.25 + cycle * 0.2;
        leftArmGroup.current.rotation.z = 0.22;
        rightArmGroup.current.rotation.x = 0.15 - cycle * 0.2;
        rightArmGroup.current.rotation.z = -0.22;
      } else if (isActivationPhase) {
        leftArmGroup.current.rotation.x = Math.sin(t * 1.0) * 0.04;
        leftArmGroup.current.rotation.z = 0.1;
        rightArmGroup.current.rotation.x = -Math.sin(t * 1.0) * 0.04;
        rightArmGroup.current.rotation.z = -0.1;
      } else {
        leftArmGroup.current.rotation.x = 0;
        leftArmGroup.current.rotation.z = 0.08;
        rightArmGroup.current.rotation.x = 0;
        rightArmGroup.current.rotation.z = -0.08;
      }
      // --- 360° double-click overrides ---
      if (orbitActive && handWave && leftArmGroup.current && rightArmGroup.current) {
        const slow = Math.sin(t * 1.4);
        leftArmGroup.current.rotation.x = slow * 0.45;
        leftArmGroup.current.rotation.z = 0.08 + Math.abs(slow) * 0.05;
        rightArmGroup.current.rotation.x = -slow * 0.45;
        rightArmGroup.current.rotation.z = -0.08 - Math.abs(slow) * 0.05;
      }
      // slow opposite walk — stays until next double-click
      if (leftLegRef.current && rightLegRef.current) {
        if (orbitActive && legWalk) {
          const slow = Math.sin(t * 1.4);
          const slow2 = Math.cos(t * 1.4);
          leftLegRef.current.rotation.x = slow * 0.42;
          rightLegRef.current.rotation.x = -slow * 0.42;
          // subtle bob when walking
          if (legsGroupRef.current) legsGroupRef.current.position.y = Math.abs(slow2) * 0.04;
        } else {
          leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0, delta * 3);
          rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, 0, delta * 3);
          if (legsGroupRef.current) legsGroupRef.current.position.y = THREE.MathUtils.lerp(legsGroupRef.current.position.y, 0, delta * 3);
        }
      }
      if (orbitActive && headNod && headGroup.current) {
        headGroup.current.rotation.x = 0.55;
        headGroup.current.rotation.y = Math.sin(t * 18) * 0.12;
      }
      if (orbitActive && chestBurst) {
        if (chestLightRef.current) chestLightRef.current.intensity = 6.5;
        if (coreRef.current) {
          const s = 1.18 + Math.sin(t * 22) * 0.08;
          coreRef.current.scale.set(s, s, s);
        }
      } else if (coreRef.current && !chestBurst) {
        coreRef.current.scale.set(1, 1, 1);
      }
    }
  });

  // Balanced scale for comfortable full-screen framing without aggressive zoom
  const actScaleBoost = isActivationPhase ? 0.04 : 0;
  const overallScale = 0.82 + actScaleBoost;

  return (
    <group ref={group} scale={overallScale} position={[0, -0.2, 0]}>
      {/* ==================== 1. PELVIS & CENTRAL STRUCTURAL SPINE ==================== */}
      <group position={[0, 0, 0]}>
        {/* Pelvic Girdle Frame */}
        <mesh position={[0, 0.78, 0]}>
          <boxGeometry args={[0.72, 0.22, 0.34]} />
          <primitive object={mats.armorDark} attach="material" />
        </mesh>
        {/* Hip ball mountings */}
        {([-1, 1] as const).map((side) => (
          <mesh key={side} position={[side * 0.38, 0.72, 0]}>
            <sphereGeometry args={[0.13, 16, 16]} />
            <primitive object={mats.goldJoint} attach="material" />
          </mesh>
        ))}

        {/* Articulated Spine Column Vertebrae */}
        {Array.from({ length: 5 }).map((_, i) => (
          <group key={i} position={[0, 0.88 + i * 0.09, -0.06]}>
            {/* Vertebra disc */}
            <mesh>
              <cylinderGeometry args={[0.07, 0.085, 0.05, 12]} />
              <primitive object={mats.titanium} attach="material" />
            </mesh>
            {/* Vertebra gold pivot */}
            <mesh position={[0, 0, 0.06]}>
              <boxGeometry args={[0.04, 0.04, 0.06]} />
              <primitive object={mats.goldJoint} attach="material" />
            </mesh>
          </group>
        ))}

        {/* Dual Neon Power Conduits Running Up the Spine */}
        {([-1, 1] as const).map((s) => (
          <mesh key={s} position={[s * 0.09, 1.08, -0.1]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.52, 8]} />
            <primitive object={mats.conduit} attach="material" />
          </mesh>
        ))}
      </group>

      {/* ==================== 2. ARTICULATED BIPEDAL LEGS — double-click in 360° to kick ==================== */}
      <group
        ref={legsGroupRef}
        visible={vis.legs > 0.01}
        position={[0, (1 - vis.legs) * 1.5, 0]}
        onDoubleClick={onLegDouble}
        onPointerOver={() => { if (orbitActive) document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}
      >
        {([-1, 1] as const).map((side) => {
          return (
            <group
              key={side}
              ref={side === -1 ? leftLegRef : rightLegRef}
              position={[side * (0.38 + exp), 0, 0]}
            >
              {/* --- Upper Thigh --- */}
              <group position={[0, 0.6, 0]}>
                {/* Thigh Core Structural Bone */}
                <mesh position={[0, -0.18, 0]}>
                  <cylinderGeometry args={[0.07, 0.07, 0.44, 12]} />
                  <primitive object={mats.titanium} attach="material" />
                </mesh>
                {/* Aerodynamic Chamfered Thigh Armor Plate */}
                <mesh position={[0, -0.18, 0.1 + exp]}>
                  <boxGeometry args={[0.3, 0.46, 0.16]} />
                  <primitive object={mats.armor} attach="material" />
                </mesh>
                {/* Chrome Hydraulic Pushrod */}
                <mesh position={[side * -0.08, -0.15, 0.08]}>
                  <cylinderGeometry args={[0.018, 0.018, 0.38, 8]} />
                  <primitive object={mats.chrome} attach="material" />
                </mesh>
                {/* Hydraulic Cylinder Housing */}
                <mesh position={[side * -0.08, -0.25, 0.08]}>
                  <cylinderGeometry args={[0.028, 0.028, 0.22, 8]} />
                  <primitive object={mats.armorDark} attach="material" />
                </mesh>
              </group>

              {/* --- Knee Servo Hub --- */}
              <group position={[0, 0.18, 0]}>
                <mesh rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.13, 0.13, 0.32, 20]} />
                  <primitive object={mats.armorDark} attach="material" />
                </mesh>
                {/* Gold Planetary Gear Cap */}
                <mesh position={[0, 0, 0.12]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.08, 0.08, 0.34, 12]} />
                  <primitive object={mats.goldJoint} attach="material" />
                </mesh>
              </group>

              {/* --- Lower Shin & Suspension — gap closed, no void at knee --- */}
              <group position={[0, -0.20, 0]}>
                {/* Shin Core — extended to hub */}
                <mesh position={[0, 0, 0]}>
                  <cylinderGeometry args={[0.06, 0.05, 0.58, 12]} />
                  <primitive object={mats.titanium} attach="material" />
                </mesh>
                {/* Knee shroud filler to close void */}
                <mesh position={[0, 0.38, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.11, 0.11, 0.18, 16]} />
                  <primitive object={mats.armor} attach="material" />
                </mesh>
                {/* Tapered Shin Armor Guard */}
                <mesh position={[0, 0, 0.1 + exp]}>
                  <boxGeometry args={[0.26, 0.52, 0.14]} />
                  <primitive object={mats.armor} attach="material" />
                </mesh>
                {/* Shin Conduit Accent Strip */}
                <mesh position={[0, 0, 0.18 + exp]}>
                  <boxGeometry args={[0.04, 0.38, 0.01]} />
                  <primitive object={mats.conduit} attach="material" />
                </mesh>
                {/* Rear Calf Shock Absorber */}
                <mesh position={[0, 0.05, -0.1]}>
                  <cylinderGeometry args={[0.025, 0.025, 0.34, 8]} />
                  <primitive object={mats.chrome} attach="material" />
                </mesh>
              </group>

              {/* --- Dual-Section Articulated Foot --- */}
              <group position={[0, -0.68, 0.06]}>
                {/* Ankle Pivot */}
                <mesh position={[0, 0.06, 0]}>
                  <sphereGeometry args={[0.09, 12, 12]} />
                  <primitive object={mats.goldJoint} attach="material" />
                </mesh>
                {/* Foot Main Tread */}
                <mesh position={[0, -0.05, 0.08]}>
                  <boxGeometry args={[0.3, 0.12, 0.42]} />
                  <primitive object={mats.armorDark} attach="material" />
                </mesh>
                {/* Articulated Toe Blade */}
                <mesh position={[0, -0.07, 0.28]}>
                  <boxGeometry args={[0.28, 0.06, 0.14]} />
                  <primitive object={mats.armor} attach="material" />
                </mesh>
                {/* Rear Heel Stabilizer Spur with Cyan Status LED */}
                <mesh position={[0, -0.04, -0.16]}>
                  <boxGeometry args={[0.2, 0.08, 0.12]} />
                  <primitive object={mats.armorDark} attach="material" />
                </mesh>
                <mesh position={[0, -0.02, -0.22]}>
                  <sphereGeometry args={[0.025, 8, 8]} />
                  <primitive object={mats.conduit} attach="material" />
                </mesh>
              </group>
            </group>
          );
        })}
      </group>

      {/* ==================== 3. TORSO, BREASTPLATE & QUANTUM ARC REACTOR ==================== */}
      <group visible={vis.torso > 0.01} position={[0, (1 - vis.torso) * 1.0, 0]}>
        {/* Main Chest Armor Shell */}
        <mesh position={[0, 1.34, 0]}>
          <boxGeometry args={[1.15, 0.85, 0.42]} />
          <primitive object={mats.armor} attach="material" />
        </mesh>
        {/* Left Pectoral Armor Plate */}
        <mesh position={[-0.32 - (1 - vis.torso) * 0.5, 1.48, 0.22 + exp]} rotation={[0, 0.08, -0.06]}>
          <boxGeometry args={[0.42, 0.36, 0.06]} />
          <primitive object={mats.armor} attach="material" />
        </mesh>
        {/* Right Pectoral Armor Plate */}
        <mesh position={[0.32 + (1 - vis.torso) * 0.5, 1.48, 0.22 + exp]} rotation={[0, -0.08, 0.06]}>
          <boxGeometry args={[0.42, 0.36, 0.06]} />
          <primitive object={mats.armor} attach="material" />
        </mesh>
        {/* Lateral Heat Exhaust Radiator Vents */}
        {([-1, 1] as const).map((s) => (
          <group key={s} position={[s * (0.46 + (1 - vis.torso) * 0.3), 1.25, 0.18 + exp]}>
            <mesh>
              <boxGeometry args={[0.12, 0.32, 0.04]} />
              <primitive object={mats.armorDark} attach="material" />
            </mesh>
            {/* Glowing internal heatsink fins */}
            <mesh position={[0, 0, 0.01]}>
              <boxGeometry args={[0.08, 0.26, 0.02]} />
              <primitive object={mats.conduit} attach="material" />
            </mesh>
          </group>
        ))}

        {/* --- QUANTUM ARC REACTOR CORE — double-click in 360° for power burst --- */}
        <group
          visible={vis.core > 0.01}
          position={[0, 1.35 + (1 - vis.core) * 1.5, 0.24 + exp * 1.5]}
          scale={0.85 + vis.core * 0.15}
          onDoubleClick={onChestDouble}
          onPointerOver={() => { if (orbitActive) document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = ''; }}
        >
          {/* Hexagonal Core Outer Housing */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.26, 0.26, 0.08, 6]} />
            <primitive object={mats.armorDark} attach="material" />
          </mesh>
          {/* Rotating Inner Magnetic Flux Confinement Rings */}
          <group ref={coreRef}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.2, 0.2, 0.09, 6]} />
              <primitive object={mats.goldJoint} attach="material" />
            </mesh>
          </group>
          {/* Pulsating Cyan Plasma Sphere */}
          <mesh>
            <sphereGeometry args={[0.13, 20, 20]} />
            <primitive object={mats.core} attach="material" />
          </mesh>
          {/* Chest Power Pulse — interval timed */}
          <pointLight
            ref={chestLightRef}
            intensity={1.2}
            distance={2.8}
            color={overdriveMode ? "#ff5500" : "#00e5ff"}
          />
        </group>

        {/* Heavy Angular Shoulder Pauldrons */}
        {([-1, 1] as const).map((side) => (
          <group key={side} position={[side * (0.68 + (1 - vis.arms) * 0.5 + exp * 1.2), 1.68, 0]}>
            {/* Pauldron Outer Shell */}
            <mesh position={[0, 0.08, 0]} rotation={[0, 0, side * -0.2]}>
              <boxGeometry args={[0.42, 0.24, 0.38]} />
              <primitive object={mats.armor} attach="material" />
            </mesh>
            {/* Pauldron Gold Pivot Pin */}
            <mesh position={[0, 0.08, 0.2]}>
              <cylinderGeometry args={[0.04, 0.04, 0.06, 12]} />
              <primitive object={mats.goldJoint} attach="material" />
            </mesh>
            {/* Shoulder Ball Joint */}
            <mesh position={[0, -0.06, 0]}>
              <sphereGeometry args={[0.14, 16, 16]} />
              <primitive object={mats.titanium} attach="material" />
            </mesh>
          </group>
        ))}
      </group>

      {/* ==================== 4. ARTICULATED ARMS & 5-FINGER HANDS ==================== */}
      <group visible={vis.arms > 0.01}>
        {/* Left Arm — double-click in 360° to wave */}
        <group
          ref={leftArmGroup}
          position={[-0.72 - (1 - vis.arms) * 0.7 - exp * 1.2, 1.62, 0]}
          onDoubleClick={onHandDouble}
          onPointerOver={() => { if (orbitActive) document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = ''; }}
        >
          {/* Upper Arm Bicep */}
          <mesh position={[0, -0.24, 0]}>
            <cylinderGeometry args={[0.08, 0.075, 0.44, 14]} />
            <primitive object={mats.armor} attach="material" />
          </mesh>
          {/* Hydraulic Bicep Assist Strut */}
          <mesh position={[-0.07, -0.24, 0.06]}>
            <cylinderGeometry args={[0.016, 0.016, 0.36, 8]} />
            <primitive object={mats.chrome} attach="material" />
          </mesh>

          {/* Elbow Servo */}
          <group position={[0, -0.5, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.1, 0.1, 0.2, 16]} />
              <primitive object={mats.armorDark} attach="material" />
            </mesh>
            <mesh position={[0, 0, 0.08]}>
              <sphereGeometry args={[0.045, 10, 10]} />
              <primitive object={mats.goldJoint} attach="material" />
            </mesh>

            {/* Forearm */}
            <group position={[0, -0.26, 0]}>
              <mesh>
                <boxGeometry args={[0.18, 0.45, 0.18]} />
                <primitive object={mats.armor} attach="material" />
              </mesh>
              {/* Forearm Data Bus LED */}
              <mesh position={[0, 0, 0.1]}>
                <boxGeometry args={[0.03, 0.32, 0.01]} />
                <primitive object={mats.conduit} attach="material" />
              </mesh>

              {/* Wrist Gimbal */}
              <mesh position={[0, -0.26, 0]}>
                <sphereGeometry args={[0.075, 12, 12]} />
                <primitive object={mats.titanium} attach="material" />
              </mesh>

              {/* Articulated 5-Finger Hand */}
              <group position={[0, -0.36, 0]}>
                {/* Palm Base */}
                <mesh>
                  <boxGeometry args={[0.14, 0.12, 0.06]} />
                  <primitive object={mats.armorDark} attach="material" />
                </mesh>
                {/* 4 Fingers + Thumb */}
                {[-0.045, -0.015, 0.015, 0.045].map((fx, fi) => (
                  <group key={fi} position={[fx, -0.08, 0]}>
                    <mesh position={[0, -0.04, 0]}>
                      <cylinderGeometry args={[0.012, 0.01, 0.08, 6]} />
                      <primitive object={mats.goldJoint} attach="material" />
                    </mesh>
                  </group>
                ))}
                {/* Thumb */}
                <mesh position={[-0.07, -0.03, 0.02]} rotation={[0, 0, -0.5]}>
                  <cylinderGeometry args={[0.012, 0.01, 0.07, 6]} />
                  <primitive object={mats.goldJoint} attach="material" />
                </mesh>
              </group>
            </group>
          </group>
        </group>

        {/* Right Arm — double-click in 360° to wave */}
        <group
          ref={rightArmGroup}
          position={[0.72 + (1 - vis.arms) * 0.7 + exp * 1.2, 1.62, 0]}
          onDoubleClick={onHandDouble}
          onPointerOver={() => { if (orbitActive) document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = ''; }}
        >
          <mesh position={[0, -0.24, 0]}>
            <cylinderGeometry args={[0.08, 0.075, 0.44, 14]} />
            <primitive object={mats.armor} attach="material" />
          </mesh>
          <mesh position={[0.07, -0.24, 0.06]}>
            <cylinderGeometry args={[0.016, 0.016, 0.36, 8]} />
            <primitive object={mats.chrome} attach="material" />
          </mesh>

          {/* Elbow Servo */}
          <group position={[0, -0.5, 0]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.1, 0.1, 0.2, 16]} />
              <primitive object={mats.armorDark} attach="material" />
            </mesh>
            <mesh position={[0, 0, 0.08]}>
              <sphereGeometry args={[0.045, 10, 10]} />
              <primitive object={mats.goldJoint} attach="material" />
            </mesh>

            {/* Forearm */}
            <group position={[0, -0.26, 0]}>
              <mesh>
                <boxGeometry args={[0.18, 0.45, 0.18]} />
                <primitive object={mats.armor} attach="material" />
              </mesh>
              <mesh position={[0, 0, 0.1]}>
                <boxGeometry args={[0.03, 0.32, 0.01]} />
                <primitive object={mats.conduit} attach="material" />
              </mesh>

              {/* Wrist Gimbal */}
              <mesh position={[0, -0.26, 0]}>
                <sphereGeometry args={[0.075, 12, 12]} />
                <primitive object={mats.titanium} attach="material" />
              </mesh>

              {/* Articulated Hand */}
              <group position={[0, -0.36, 0]}>
                <mesh>
                  <boxGeometry args={[0.14, 0.12, 0.06]} />
                  <primitive object={mats.armorDark} attach="material" />
                </mesh>
                {[-0.045, -0.015, 0.015, 0.045].map((fx, fi) => (
                  <group key={fi} position={[fx, -0.08, 0]}>
                    <mesh position={[0, -0.04, 0]}>
                      <cylinderGeometry args={[0.012, 0.01, 0.08, 6]} />
                      <primitive object={mats.goldJoint} attach="material" />
                    </mesh>
                  </group>
                ))}
                <mesh position={[0.07, -0.03, 0.02]} rotation={[0, 0, 0.5]}>
                  <cylinderGeometry args={[0.012, 0.01, 0.07, 6]} />
                  <primitive object={mats.goldJoint} attach="material" />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* ==================== 5. HIGH-TECH CRANIAL HELMET, QUANTUM BRAIN & VISOR ==================== */}
      <group
        visible={vis.head > 0.01}
        position={[0, 1.95 + (1 - vis.head) * 0.8, 0.04]}
        onDoubleClick={onHeadDouble}
        onPointerOver={() => { if (orbitActive) document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}
      >
        <group ref={headGroup}>
          {/* Neck Cervical Joint */}
          <mesh position={[0, -0.16, 0]}>
            <cylinderGeometry args={[0.085, 0.095, 0.14, 16]} />
            <primitive object={mats.titanium} attach="material" />
          </mesh>

          {/* Cranium Base Frame */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.48, 0.38, 0.44]} />
            <primitive object={mats.armor} attach="material" />
          </mesh>

          {/* INTERNAL QUANTUM AI BRAIN (Revealed when lid opens or X-ray mode) */}
          <group position={[0, 0.04, 0]}>
            <mesh rotation={[ms * 0.001, ms * 0.0015, 0]}>
              <octahedronGeometry args={[0.13, 1]} />
              <primitive object={mats.conduit} attach="material" />
            </mesh>
            <pointLight intensity={isAIPhase ? 2.5 : 0.8} distance={1.8} color="#00e5ff" />
          </group>

          {/* HINGED TOP CRANIAL LID / CAP */}
          <group ref={cranialCapRef} position={[0, 0, 0]}>
            <mesh position={[0, 0.22 + exp * 1.5, -0.02]}>
              <boxGeometry args={[0.5, 0.08, 0.46]} />
              <primitive object={mats.armor} attach="material" />
            </mesh>
            {/* Aerodynamic Crest Blade */}
            <mesh position={[0, 0.28 + exp * 1.5, 0]}>
              <boxGeometry args={[0.05, 0.08, 0.36]} />
              <primitive object={mats.goldJoint} attach="material" />
            </mesh>
          </group>

          {/* Cheek & Jaw Armor Guards */}
          {([-1, 1] as const).map((side) => (
            <mesh
              key={side}
              position={[side * (0.26 + exp), -0.08, 0.06]}
              rotation={[0, side * 0.15, 0]}
            >
              <boxGeometry args={[0.08, 0.24, 0.3]} />
              <primitive object={mats.armorDark} attach="material" />
            </mesh>
          ))}

          {/* CURVED OBSIDIAN VISOR WITH DUAL OCULAR LENSES */}
          <group position={[0, -0.02, 0.23 + exp]}>
            {/* Smoked Visor Faceplate */}
            <mesh>
              <boxGeometry args={[0.42, 0.18, 0.06]} />
              <primitive object={mats.visor} attach="material" />
            </mesh>
            {/* Dual Ocular Lenses — fixed size, no big bloom */}
            <mesh ref={leftEyeRef} position={[-0.11, 0, 0.04]}>
              <sphereGeometry args={[0.038, 14, 14]} />
              <primitive object={mats.eye} attach="material" />
            </mesh>
            <mesh ref={rightEyeRef} position={[0.11, 0, 0.04]}>
              <sphereGeometry args={[0.038, 14, 14]} />
              <primitive object={mats.eye} attach="material" />
            </mesh>
            {/* Horizontal HUD Scan Line */}
            <mesh position={[0, Math.sin(ms * 0.005) * 0.04, 0.04]}>
              <boxGeometry args={[0.34, 0.008, 0.01]} />
              <primitive object={mats.conduit} attach="material" />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}
