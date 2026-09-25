"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { clamp01 } from "@/lib/animate";

interface IndustrialArmsProps {
  p: number;
  ms: number;
}

// Particle spark system for realistic laser welding
function WeldingSparks({ active, position }: { active: boolean; position: THREE.Vector3 }) {
  const count = 60;
  const particlesRef = useRef<THREE.Points>(null);

  const [positions, velocities, lifespans] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const life = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = position.x;
      pos[i * 3 + 1] = position.y;
      pos[i * 3 + 2] = position.z;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.2) * Math.PI * 0.5;
      const speed = 0.6 + Math.random() * 1.8;
      vel[i * 3] = Math.cos(theta) * Math.cos(phi) * speed;
      vel[i * 3 + 1] = Math.sin(phi) * speed + 0.6;
      vel[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * speed;
      life[i] = Math.random();
    }
    return [pos, vel, life];
  }, [position]);

  useFrame((_, delta) => {
    if (!particlesRef.current) return;
    const geom = particlesRef.current.geometry;
    const posAttr = geom.attributes.position as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      if (!active) {
        posArr[i * 3 + 1] = -10; // hide offscreen
        continue;
      }

      lifespans[i] += delta * 3.2;
      if (lifespans[i] > 1) {
        lifespans[i] = 0;
        posArr[i * 3] = position.x + (Math.random() - 0.5) * 0.04;
        posArr[i * 3 + 1] = position.y + (Math.random() - 0.5) * 0.04;
        posArr[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.04;

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.45;
        const speed = 0.8 + Math.random() * 2.0;
        velocities[i * 3] = Math.cos(theta) * Math.cos(phi) * speed;
        velocities[i * 3 + 1] = Math.sin(phi) * speed + 0.4;
        velocities[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * speed;
      } else {
        velocities[i * 3 + 1] -= delta * 5.0; // gravity
        posArr[i * 3] += velocities[i * 3] * delta;
        posArr[i * 3 + 1] += velocities[i * 3 + 1] * delta;
        posArr[i * 3 + 2] += velocities[i * 3 + 2] * delta;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.032}
        color="#ffaa33"
        transparent
        opacity={active ? 0.95 : 0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export function IndustrialArms({ p, ms }: IndustrialArmsProps) {
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftNozzleRef = useRef<THREE.Group>(null);
  const laserBeamRef = useRef<THREE.Mesh>(null);
  const rightToolRef = useRef<THREE.Group>(null);

  // STRICTLY active during Chapter 02: Assembly (0.13 to 0.40)
  const isAssembly = p >= 0.14 && p <= 0.38;
  const inRange = p >= 0.10 && p <= 0.42;

  // Active weld target on the robot based on assembly sub-stages
  const weldTarget = useMemo(() => {
    if (p < 0.21) {
      // Stage 1: Welding hip / leg pivot
      return new THREE.Vector3(-0.32, 0.42, 0.12);
    } else if (p < 0.28) {
      // Stage 2: Welding central chest / sternum seam
      return new THREE.Vector3(-0.02, 0.95, 0.18);
    } else if (p < 0.35) {
      // Stage 3: Welding left shoulder socket
      return new THREE.Vector3(-0.58, 1.15, 0.08);
    } else {
      // Stage 4: Quantum core lock seam
      return new THREE.Vector3(-0.16, 0.88, 0.22);
    }
  }, [p]);

  const boltTarget = useMemo(() => {
    if (p < 0.21) {
      return new THREE.Vector3(0.32, 0.42, 0.12);
    } else if (p < 0.28) {
      return new THREE.Vector3(0.24, 0.95, 0.18);
    } else {
      return new THREE.Vector3(0.58, 1.15, 0.08);
    }
  }, [p]);

  useFrame((_, delta) => {
    const t = ms * 0.001;

    // Left Welder Arm kinematic tracking
    if (leftArmRef.current) {
      if (isAssembly) {
        // Position arm so its toolhead comfortably points at the weld seam
        const targetX = weldTarget.x - 1.1;
        const targetY = weldTarget.y + 0.15;
        leftArmRef.current.position.x = THREE.MathUtils.lerp(leftArmRef.current.position.x, targetX, delta * 3.5);
        leftArmRef.current.position.y = THREE.MathUtils.lerp(leftArmRef.current.position.y, targetY, delta * 3.5);
        leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, -0.22, delta * 3.0);
      } else {
        // Parked in perimeter standby
        leftArmRef.current.position.x = THREE.MathUtils.lerp(leftArmRef.current.position.x, -2.4, delta * 2.0);
        leftArmRef.current.position.y = THREE.MathUtils.lerp(leftArmRef.current.position.y, 0.2, delta * 2.0);
        leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, -0.6, delta * 2.0);
      }
    }

    // Right Nutrunner Arm tracking
    if (rightArmRef.current) {
      if (isAssembly) {
        const targetX = boltTarget.x + 1.1;
        const targetY = boltTarget.y + 0.15;
        rightArmRef.current.position.x = THREE.MathUtils.lerp(rightArmRef.current.position.x, targetX, delta * 3.5);
        rightArmRef.current.position.y = THREE.MathUtils.lerp(rightArmRef.current.position.y, targetY, delta * 3.5);
        rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, 0.22, delta * 3.0);
      } else {
        rightArmRef.current.position.x = THREE.MathUtils.lerp(rightArmRef.current.position.x, 2.4, delta * 2.0);
        rightArmRef.current.position.y = THREE.MathUtils.lerp(rightArmRef.current.position.y, 0.2, delta * 2.0);
        rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, 0.6, delta * 2.0);
      }
    }

    // Continuously align the laser beam between the nozzle and the weld target
    if (laserBeamRef.current && leftNozzleRef.current && isAssembly) {
      const nozzleWorld = new THREE.Vector3();
      leftNozzleRef.current.getWorldPosition(nozzleWorld);
      const dist = nozzleWorld.distanceTo(weldTarget);
      laserBeamRef.current.scale.set(1, dist, 1);
      laserBeamRef.current.position.copy(nozzleWorld.clone().lerp(weldTarget, 0.5));
      const dir = weldTarget.clone().sub(nozzleWorld).normalize();
      laserBeamRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }

    // Spin bolter tool
    if (rightToolRef.current && isAssembly) {
      rightToolRef.current.rotation.z += 0.35;
    }
  });

  if (!inRange) return null;

  return (
    <group position={[0, -0.2, 0]}>
      {/* ============ LEFT INDUSTRIAL ROBOTIC ARM (LASER FUSION WELDER) ============ */}
      <group ref={leftArmRef} position={[-2.4, 0.2, 0.3]}>
        {/* Base Pedestal */}
        <mesh position={[0, -0.65, 0]}>
          <cylinderGeometry args={[0.26, 0.32, 0.5, 16]} />
          <meshStandardMaterial color="#111822" roughness={0.4} metalness={0.7} />
        </mesh>
        <mesh position={[0, -0.42, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 0.03, 16]} />
          <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={1.0} />
        </mesh>
        <mesh position={[0, -0.3, 0]}>
          <sphereGeometry args={[0.2, 14, 14]} />
          <meshStandardMaterial color="#1a2533" roughness={0.3} metalness={0.8} />
        </mesh>

        {/* Boom Link 1 */}
        <group position={[0, -0.15, 0]} rotation={[0, 0, 0.4]}>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[0.16, 0.9, 0.18]} />
            <meshStandardMaterial color="#182330" roughness={0.35} metalness={0.75} />
          </mesh>

          {/* Elbow Joint */}
          <group position={[0, 0.9, 0]} rotation={[0, 0, -0.8]}>
            <mesh>
              <cylinderGeometry args={[0.14, 0.14, 0.22, 14]} />
              <meshStandardMaterial color="#0c131c" roughness={0.3} metalness={0.9} />
            </mesh>
            {/* Forearm Link 2 */}
            <mesh position={[0, 0.4, 0]}>
              <boxGeometry args={[0.14, 0.8, 0.14]} />
              <meshStandardMaterial color="#1a2636" roughness={0.35} metalness={0.75} />
            </mesh>

            {/* Laser Welder Toolhead */}
            <group ref={leftNozzleRef} position={[0, 0.8, 0]} rotation={[0, 0, 0.4]}>
              <mesh>
                <sphereGeometry args={[0.09, 12, 12]} />
                <meshStandardMaterial color="#223344" roughness={0.2} metalness={0.85} />
              </mesh>
              <mesh position={[0.1, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <coneGeometry args={[0.045, 0.2, 12]} />
                <meshStandardMaterial color="#334455" roughness={0.2} metalness={0.9} />
              </mesh>
            </group>
          </group>
        </group>
      </group>

      {/* CONTINUOUS DIRECT LASER WELDING BEAM */}
      {isAssembly && (
        <>
          <mesh ref={laserBeamRef}>
            <cylinderGeometry args={[0.008, 0.008, 1, 8]} />
            <meshBasicMaterial color="#00e5ff" transparent opacity={0.9} />
          </mesh>
          {/* Intense weld contact bead */}
          <mesh position={weldTarget}>
            <sphereGeometry args={[0.035, 10, 10]} />
            <meshBasicMaterial color="#ffeedd" />
          </mesh>
          <pointLight
            position={weldTarget}
            intensity={2.2 + Math.sin(ms * 0.08) * 1.0}
            distance={1.6}
            color="#00e5ff"
          />
        </>
      )}

      {/* Shower of plasma sparks at weld point */}
      <WeldingSparks active={isAssembly} position={weldTarget} />

      {/* ============ RIGHT INDUSTRIAL ROBOTIC ARM (NUTRUNNER / BOLTER) ============ */}
      <group ref={rightArmRef} position={[2.4, 0.2, 0.3]}>
        <mesh position={[0, -0.65, 0]}>
          <cylinderGeometry args={[0.26, 0.32, 0.5, 16]} />
          <meshStandardMaterial color="#111822" roughness={0.4} metalness={0.7} />
        </mesh>
        <mesh position={[0, -0.42, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 0.03, 16]} />
          <meshStandardMaterial color="#4dffb0" emissive="#4dffb0" emissiveIntensity={1.0} />
        </mesh>
        <mesh position={[0, -0.3, 0]}>
          <sphereGeometry args={[0.2, 14, 14]} />
          <meshStandardMaterial color="#1a2533" roughness={0.3} metalness={0.8} />
        </mesh>

        <group position={[0, -0.15, 0]} rotation={[0, 0, -0.4]}>
          <mesh position={[0, 0.45, 0]}>
            <boxGeometry args={[0.16, 0.9, 0.18]} />
            <meshStandardMaterial color="#182330" roughness={0.35} metalness={0.75} />
          </mesh>

          <group position={[0, 0.9, 0]} rotation={[0, 0, 0.8]}>
            <mesh>
              <cylinderGeometry args={[0.14, 0.14, 0.22, 14]} />
              <meshStandardMaterial color="#0c131c" roughness={0.3} metalness={0.9} />
            </mesh>
            <mesh position={[0, 0.4, 0]}>
              <boxGeometry args={[0.14, 0.8, 0.14]} />
              <meshStandardMaterial color="#1a2636" roughness={0.35} metalness={0.75} />
            </mesh>

            {/* Nutrunner Toolhead */}
            <group ref={rightToolRef} position={[0, 0.8, 0]} rotation={[0, 0, -0.4]}>
              <mesh>
                <cylinderGeometry args={[0.07, 0.07, 0.18, 14]} />
                <meshStandardMaterial color="#2a3d55" roughness={0.25} metalness={0.8} />
              </mesh>
              <mesh position={[-0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.028, 0.015, 0.22, 10]} />
                <meshStandardMaterial color="#d4af37" roughness={0.2} metalness={0.9} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
