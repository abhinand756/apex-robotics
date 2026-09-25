"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clamp01, easeInOutCubic } from "@/lib/animate";

interface TestingStageProps {
  p: number;
  ms: number;
}

export function TestingStage({ p, ms }: TestingStageProps) {
  const scanRingGroup = useRef<THREE.Group>(null);
  const pulseFloorRef = useRef<THREE.Mesh>(null);

  // STRICTLY active during Chapter 05: Testing (0.78 to 0.895)
  const inPhase = p >= 0.77 && p <= 0.895;
  const phaseWeight = inPhase
    ? p < 0.80
      ? easeInOutCubic((p - 0.77) / 0.03)
      : p > 0.87
      ? 1 - easeInOutCubic((p - 0.87) / 0.025)
      : 1
    : 0;

  useFrame(() => {
    const t = ms * 0.001;
    // Smooth vertical laser diagnostic sweep (covers full height from feet -0.9 to head +1.8)
    if (scanRingGroup.current) {
      const sweepY = 0.45 + Math.sin(t * 2.0) * 1.35;
      scanRingGroup.current.position.y = sweepY;
    }

    if (pulseFloorRef.current) {
      const s = 1.0 + (Math.sin(t * 3.0) * 0.5 + 0.5) * 0.12;
      pulseFloorRef.current.scale.set(s, s, s);
    }
  });

  if (!inPhase || phaseWeight <= 0.01) return null;

  return (
    <group position={[0, -0.2, 0]}>
      {/* ============ SWEEPING DUAL-RING LASER SCANNER ============ */}
      <group ref={scanRingGroup} position={[0, 0.45, 0]} scale={phaseWeight}>
        {/* Primary Cyan Laser Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.1, 0.015, 16, 64]} />
          <meshBasicMaterial color="#00e5ff" transparent opacity={0.85 * phaseWeight} />
        </mesh>
        {/* Secondary Concentric Amber Calibration Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.98, 0.008, 16, 64]} />
          <meshBasicMaterial color="#ffb020" transparent opacity={0.65 * phaseWeight} />
        </mesh>
        {/* Soft Planar Laser Cross-Section Fan */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.08, 1.08, 48]} />
          <meshBasicMaterial
            color="#00e5ff"
            transparent
            opacity={0.09 * phaseWeight}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <pointLight intensity={1.2 * phaseWeight} distance={1.8} color="#00e5ff" />
      </group>

      {/* ============ GROUND TESTING CALIBRATION PLATFORM ============ */}
      <mesh
        ref={pulseFloorRef}
        position={[0, -1.0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[1.35, 1.39, 48]} />
        <meshBasicMaterial
          color="#00e5ff"
          transparent
          opacity={0.5 * phaseWeight}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
