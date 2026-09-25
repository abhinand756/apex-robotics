"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { easeInOutCubic } from "@/lib/animate";

interface NeuralStageProps {
  p: number;
  ms: number;
}

export function NeuralStage({ p, ms }: NeuralStageProps) {
  const ringsRef = useRef<THREE.Group>(null);
  const scanConeRef = useRef<THREE.Mesh>(null);
  const synapticLinesRef = useRef<THREE.LineSegments>(null);

  // STRICTLY active during Chapter 03: AI Core (0.40 to 0.61)
  const inPhase = p >= 0.40 && p <= 0.61;
  const phaseWeight = inPhase
    ? p < 0.43
      ? easeInOutCubic((p - 0.40) / 0.03)
      : p > 0.57
      ? 1 - easeInOutCubic((p - 0.57) / 0.04)
      : 1
    : 0;

  // Generate 3D synaptic lattice points inside and around the cranium (scaled for base scale 0.82)
  const [nodes, linePositions] = useMemo(() => {
    const nodeCount = 28;
    const nodeList: THREE.Vector3[] = [];
    // Cranium center is around [0, 1.4, 0.05]
    for (let i = 0; i < nodeCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = Math.cbrt(Math.random()) * 0.32;
      const sinPhi = Math.sin(phi);
      const x = r * sinPhi * Math.cos(theta);
      const y = 1.4 + r * sinPhi * Math.sin(theta) * 0.85;
      const z = 0.05 + r * Math.cos(phi);
      nodeList.push(new THREE.Vector3(x, y, z));
    }

    // Connect close neighbors
    const lineCoords: number[] = [];
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const dist = nodeList[i].distanceTo(nodeList[j]);
        if (dist < 0.22) {
          lineCoords.push(nodeList[i].x, nodeList[i].y, nodeList[i].z);
          lineCoords.push(nodeList[j].x, nodeList[j].y, nodeList[j].z);
        }
      }
    }
    return [nodeList, new Float32Array(lineCoords)];
  }, []);

  useFrame(() => {
    const t = ms * 0.001;
    // Rotate consciousness rings
    if (ringsRef.current) {
      ringsRef.current.children[0].rotation.z = t * 0.7;
      ringsRef.current.children[1].rotation.x = t * -0.5;
      ringsRef.current.children[2].rotation.y = t * 0.6;
    }

    // Oscillate lidar scan cone
    if (scanConeRef.current) {
      scanConeRef.current.rotation.y = Math.sin(t * 1.4) * 0.28;
      scanConeRef.current.rotation.x = -Math.PI / 2 + Math.sin(t * 0.8) * 0.1;
    }
  });

  if (!inPhase || phaseWeight <= 0.01) return null;

  return (
    <group position={[0, -0.2, 0]}>
      {/* ============ HOLOGRAPHIC CONSCIOUSNESS RINGS ============ */}
      <group ref={ringsRef} position={[0, 1.4, 0.05]} scale={phaseWeight}>
        {/* Ring 1 - Equatorial Data Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.44, 0.455, 36]} />
          <meshBasicMaterial
            color="#00e5ff"
            transparent
            opacity={0.65 * phaseWeight}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Ring 2 - Polar Neural Ring */}
        <mesh rotation={[0, Math.PI / 4, 0]}>
          <ringGeometry args={[0.49, 0.505, 36]} />
          <meshBasicMaterial
            color="#8b7bff"
            transparent
            opacity={0.55 * phaseWeight}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Ring 3 - Orbiting Tick Marks */}
        <mesh rotation={[Math.PI / 3, Math.PI / 6, 0]}>
          <ringGeometry args={[0.54, 0.55, 24]} />
          <meshBasicMaterial
            color="#4dffb0"
            transparent
            opacity={0.45 * phaseWeight}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* ============ SYNAPTIC NEURAL NETWORK ============ */}
      <group scale={phaseWeight}>
        <lineSegments ref={synapticLinesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[linePositions, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color="#00e5ff"
            transparent
            opacity={0.7 * phaseWeight}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>

        {nodes.map((pos, idx) => (
          <mesh key={idx} position={[pos.x, pos.y, pos.z]}>
            <sphereGeometry args={[0.012, 6, 6]} />
            <meshBasicMaterial
              color={idx % 3 === 0 ? "#4dffb0" : idx % 2 === 0 ? "#00e5ff" : "#8b7bff"}
            />
          </mesh>
        ))}

        <pointLight
          position={[0, 1.4, 0.05]}
          intensity={1.5 * phaseWeight}
          distance={1.6}
          color="#00e5ff"
        />
      </group>

      {/* ============ 3D FORWARD LIDAR SENSOR CONE ============ */}
      <mesh
        ref={scanConeRef}
        position={[0, 1.38, 0.2]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[phaseWeight, phaseWeight, phaseWeight]}
      >
        <coneGeometry args={[0.7, 1.4, 20, 2, true]} />
        <meshBasicMaterial
          color="#00e5ff"
          transparent
          opacity={0.08 * phaseWeight}
          wireframe
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
