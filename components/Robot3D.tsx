"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { RobotModel } from "./robot/RobotModel";
import { IndustrialArms } from "./robot/IndustrialArms";
import { NeuralStage } from "./robot/NeuralStage";
import { TestingStage } from "./robot/TestingStage";
import { GantryFloor } from "./robot/GantryFloor";

interface Scene3DProps {
  p: number;
  ms: number;
  orbitActive?: boolean;
  xrayActive?: boolean;
  explodedActive?: boolean;
  overdriveActive?: boolean;
}

// Dynamic Cinematic Camera Director based on scroll phase
function CameraDirector({ p, orbitActive }: { p: number; orbitActive: boolean }) {
  const targetPos = useRef(new THREE.Vector3(0, 1.1, 5.5));
  const targetLook = useRef(new THREE.Vector3(0, 0.5, 0));

  useFrame(({ camera }, delta) => {
    if (orbitActive) return; // OrbitControls is active

    if (p < 0.14) {
      // Phase 1: Factory overview — grand cinematic gantry perspective
      targetPos.current.set(0, 1.1, 5.8);
      targetLook.current.set(0, 0.45, 0);
    } else if (p < 0.40) {
      // Phase 2: Assembly — comfortable framing of both industrial arms and robot
      targetPos.current.set(0, 0.75, 5.0);
      targetLook.current.set(0, 0.5, 0);
    } else if (p < 0.63) {
      // Phase 3: AI Brain — clear view of cranium, quantum core, hands, and neural halo
      targetPos.current.set(0, 1.0, 4.2);
      targetLook.current.set(0, 0.85, 0);
    } else if (p < 0.90) {
      // Phase 4: Testing chamber — full body visible for sweeping laser scanner
      targetPos.current.set(0, 0.65, 5.0);
      targetLook.current.set(0, 0.45, 0);
    } else {
      // Phase 5: Hero Finished Robot — commanding full-figure hero framing
      targetPos.current.set(0, 0.6, 4.6);
      targetLook.current.set(0, 0.55, 0);
    }

    camera.position.lerp(targetPos.current, delta * 3.0);
    camera.lookAt(targetLook.current);
  });

  return null;
}

export function Scene3D({
  p,
  ms,
  orbitActive = false,
  xrayActive = false,
  explodedActive = false,
  overdriveActive = false,
}: Scene3DProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 1.1, 5.5], fov: 42 }}
      style={{ position: "absolute", inset: 0, background: "transparent" }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      dpr={[1, 2]}
    >
      {/* Creative Factory & Robo Visibility Lighting */}
      <ambientLight intensity={0.92} />
      <hemisphereLight args={["#eaf6ff", "#0a0f16", 0.55]} />
      <directionalLight
        position={[3.0, 4.5, 3.5]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
      />
      {/* Overhead factory spot — makes robo pop */}
      <spotLight
        position={[0, 4.2, 1.8]}
        angle={0.42}
        penumbra={0.35}
        intensity={2.8}
        distance={8}
        decay={1.2}
        color="#eaf6ff"
        castShadow
      />
      {/* Cyan rim + warm fill for depth */}
      <directionalLight position={[-3.2, 2.5, -2.5]} intensity={1.35} color="#00e5ff" />
      <directionalLight position={[2.5, -1.0, 2.0]} intensity={0.55} color="#ffb020" />
      {/* Robo chest & foot fill lights */}
      <pointLight position={[0, 0.9, 1.4]} intensity={0.65} distance={2.8} color="#7fd9ff" />
      <pointLight position={[0, -1.2, 0.5]} intensity={1.0} distance={3.2} color="#00e5ff" />
      {/* Factory ceiling neon strip */}
      <pointLight position={[0, 2.8, -0.8]} intensity={0.9} distance={5} color="#8b7bff" />

      {/* Dynamic Camera Director */}
      <CameraDirector p={p} orbitActive={orbitActive} />

      {/* 360° inspect — slightly lower framing, no jump */}
      {orbitActive && (
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          enableDamping
          dampingFactor={0.08}
          minDistance={1.8}
          maxDistance={5.5}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.9}
          target={[0, 0.42, 0]}
        />
      )}

      {/* ============ 3D STAGE COMPONENTS ============ */}
      {/* 1. Staging Bay Floor & Laser Guidance */}
      <GantryFloor p={p} ms={ms} />

      {/* 2. Articulated Industrial Robotic Arms & Plasma Sparks (Phase 2) */}
      <IndustrialArms p={p} ms={ms} />

      {/* 3. AI Brain Synaptic Network & Lidar Cone (Phase 3) */}
      <NeuralStage p={p} ms={ms} />

      {/* 4. Sweeping Laser Diagnostic Scanner Rings (Phase 4) */}
      <TestingStage p={p} ms={ms} />

      {/* 5. Sleek Futuristic AI Humanoid Robot — double-click parts in 360° */}
      <RobotModel
        p={p}
        ms={ms}
        xrayMode={xrayActive}
        explodedMode={explodedActive}
        overdriveMode={overdriveActive}
        orbitActive={orbitActive}
      />

      {/* Ground Contact Shadow */}
      <ContactShadows
        position={[0, -1.44, 0]}
        opacity={0.45}
        scale={4.0}
        blur={2.0}
        far={2.5}
      />

      {/* Environment reflections — brighter for robo visibility */}
      <Environment preset="city" environmentIntensity={0.52} />
    </Canvas>
  );
}
