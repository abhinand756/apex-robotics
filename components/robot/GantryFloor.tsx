"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface GantryFloorProps {
  p: number;
  ms: number;
}

export function GantryFloor({ p, ms }: GantryFloorProps) {
  const dustRef = useRef<THREE.Points>(null);

  // Volumetric floating particles inside factory bay
  const [dustPositions] = useMemo(() => {
    const count = 75;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 5.0;
      pos[i * 3 + 1] = Math.random() * 3.5 - 1.2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4.0;
    }
    return [pos];
  }, []);

  useFrame((_, delta) => {
    if (dustRef.current) {
      const posAttr = dustRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < 75; i++) {
        arr[i * 3 + 1] += delta * 0.06;
        if (arr[i * 3 + 1] > 2.5) {
          arr[i * 3 + 1] = -1.2;
        }
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <group position={[0, -1.1, 0]}>
      {/* Subtle floor ambient glow beacon at the base — completely open, no solid semicircle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.4, 0.42, 32]} />
        <meshBasicMaterial
          color="#00e5ff"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Volumetric Factory Ambient Dust Particles */}
      <points ref={dustRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[dustPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.022}
          color="#7fd9ff"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}
