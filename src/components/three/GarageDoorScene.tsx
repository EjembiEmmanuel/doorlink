'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, RoundedBox, Sky } from '@react-three/drei'
import * as THREE from 'three'

const PANEL_COUNT = 4
const DOOR_WIDTH = 3.2
const DOOR_HEIGHT = 2.6
const PANEL_GAP = 0.03
const PANEL_HEIGHT = (DOOR_HEIGHT - PANEL_GAP * (PANEL_COUNT - 1)) / PANEL_COUNT
const PANEL_DEPTH = 0.14
// How far a panel travels once fully "open" — enough to clear the frame's
// header, which is sized to match so the panels read as sliding up into
// the ceiling rather than just vanishing.
const LIFT_HEIGHT = DOOR_HEIGHT + 0.9
const FLOOR_Y = -DOOR_HEIGHT / 2 - 0.42

function HardwareBracket({ x }: { x: number }) {
  return (
    <group position={[x, 0, PANEL_DEPTH / 2 + 0.006]}>
      <mesh castShadow>
        <boxGeometry args={[0.12, 0.09, 0.02]} />
        <meshStandardMaterial color="#b7bbc0" roughness={0.35} metalness={0.75} />
      </mesh>
      <mesh position={[0, 0, 0.015]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.03, 16]} />
        <meshStandardMaterial color="#8a8e93" roughness={0.25} metalness={0.85} />
      </mesh>
    </group>
  )
}

function Panel({ index, isOpen, color }: { index: number; isOpen: boolean; color: string }) {
  const ref = useRef<THREE.Group>(null)
  const restY = index * (PANEL_HEIGHT + PANEL_GAP) - DOOR_HEIGHT / 2 + PANEL_HEIGHT / 2
  const progress = useRef(0)

  // A real sectional door folds bottom-first on the way up and top-first
  // on the way down; staggering each panel's damping start approximates
  // that without simulating the actual curved track.
  const order = isOpen ? index : PANEL_COUNT - 1 - index

  useFrame((_, delta) => {
    if (!ref.current) return
    const target = isOpen ? 1 : 0
    const staggerDelay = order * 0.05
    const laggedDelta = Math.max(delta - staggerDelay * 0.4, delta * 0.15)
    progress.current = THREE.MathUtils.damp(progress.current, target, 3.2, laggedDelta)
    ref.current.position.y = restY + progress.current * LIFT_HEIGHT
  })

  return (
    <group ref={ref} position={[0, restY, 0]}>
      <RoundedBox args={[DOOR_WIDTH, PANEL_HEIGHT, PANEL_DEPTH]} radius={0.016} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.42} metalness={0.35} />
      </RoundedBox>

      {/* Two ribbed grooves per panel, echoing a real rolled-steel sectional door's profile */}
      {[0.32, -0.1].map((yOffset) => (
        <mesh key={yOffset} position={[0, PANEL_HEIGHT * yOffset, PANEL_DEPTH / 2 + 0.002]}>
          <boxGeometry args={[DOOR_WIDTH - 0.04, 0.018, 0.008]} />
          <meshStandardMaterial color="#000000" transparent opacity={0.32} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, PANEL_HEIGHT * 0.34, PANEL_DEPTH / 2 + 0.003]}>
        <boxGeometry args={[DOOR_WIDTH - 0.04, 0.008, 0.006]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.15} />
      </mesh>

      {index === PANEL_COUNT - 1 && (
        <group position={[0, 0, PANEL_DEPTH / 2 + 0.004]}>
          {[-1, -0.34, 0.34, 1].map((x) => (
            <mesh key={x} position={[x * (DOOR_WIDTH / 2 - 0.52), 0, 0]}>
              <planeGeometry args={[0.42, PANEL_HEIGHT - 0.18]} />
              <meshPhysicalMaterial
                color="#dce6f0"
                emissive="#bcd3e6"
                emissiveIntensity={0.35}
                roughness={0.05}
                metalness={0}
                clearcoat={1}
                transmission={0.3}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* Roller/hinge hardware at each panel's edges — cheap visual cue that this is a real mechanism, not a flat slab */}
      <HardwareBracket x={-DOOR_WIDTH / 2 + 0.32} />
      <HardwareBracket x={DOOR_WIDTH / 2 - 0.32} />

      {index === 1 && (
        <mesh position={[DOOR_WIDTH / 2 - 0.68, 0, PANEL_DEPTH / 2 + 0.02]} castShadow>
          <boxGeometry args={[0.16, 0.05, 0.035]} />
          <meshStandardMaterial color="#c9cdd1" roughness={0.25} metalness={0.8} />
        </mesh>
      )}
    </group>
  )
}

function Facade() {
  const jambWidth = 0.3
  const wallZ = PANEL_DEPTH / 2 + 0.03
  const height = DOOR_HEIGHT + LIFT_HEIGHT + 0.6
  const y = FLOOR_Y + height / 2
  const jambX = DOOR_WIDTH / 2 + jambWidth / 2
  const wallMaterial = <meshStandardMaterial color="#E4E2DC" roughness={0.92} />

  return (
    <group>
      <mesh position={[-jambX, y, wallZ]} castShadow receiveShadow>
        <boxGeometry args={[jambWidth, height, 0.4]} />
        {wallMaterial}
      </mesh>
      <mesh position={[jambX, y, wallZ]} castShadow receiveShadow>
        <boxGeometry args={[jambWidth, height, 0.4]} />
        {wallMaterial}
      </mesh>
      <mesh position={[0, DOOR_HEIGHT / 2 + (LIFT_HEIGHT + 0.6) / 2, wallZ]} castShadow receiveShadow>
        <boxGeometry args={[DOOR_WIDTH + jambWidth * 2, LIFT_HEIGHT + 0.6, 0.4]} />
        {wallMaterial}
      </mesh>
    </group>
  )
}

export function GarageDoorScene({ isOpen }: { isOpen: boolean }) {
  return (
    <Canvas
      shadows="soft"
      dpr={[1, 1.5]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      camera={{ position: [3.4, 1.5, 4.6], fov: 32 }}
    >
      <Sky sunPosition={[8, 5, 6]} turbidity={4} rayleigh={1.2} mieCoefficient={0.02} mieDirectionalG={0.9} />
      <fog attach="fog" args={['#cfd8e3', 9, 21]} />

      <ambientLight intensity={0.28} />
      <directionalLight
        position={[6, 7, 5]}
        intensity={1.6}
        color="#fff3e0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0015}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <directionalLight position={[-5, 3, -3]} intensity={0.3} color="#cbd9ff" />

      <Facade />
      {Array.from({ length: PANEL_COUNT }, (_, i) => (
        <Panel key={i} index={i} isOpen={isOpen} color="#2C3033" />
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#d9d5cb" roughness={0.96} />
      </mesh>

      <OrbitControls
        target={[0, 0.7, 0]}
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={0.6}
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={Math.PI / 2 - 0.45}
        maxPolarAngle={Math.PI / 2 + 0.12}
        minAzimuthAngle={-Math.PI / 2.3}
        maxAzimuthAngle={Math.PI / 2.3}
      />
    </Canvas>
  )
}
