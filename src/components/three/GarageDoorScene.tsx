'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
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
      <mesh>
        <boxGeometry args={[DOOR_WIDTH, PANEL_HEIGHT, PANEL_DEPTH]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh position={[0, PANEL_HEIGHT / 2 - 0.015, PANEL_DEPTH / 2 + 0.002]}>
        <boxGeometry args={[DOOR_WIDTH, 0.02, 0.01]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.08} />
      </mesh>
      {index === PANEL_COUNT - 1 && (
        <group position={[0, 0, PANEL_DEPTH / 2 + 0.004]}>
          {[-1, -0.34, 0.34, 1].map((x) => (
            <mesh key={x} position={[x * (DOOR_WIDTH / 2 - 0.52), 0, 0]}>
              <planeGeometry args={[0.42, PANEL_HEIGHT - 0.18]} />
              <meshStandardMaterial color="#dce6f0" emissive="#dce6f0" emissiveIntensity={0.5} roughness={0.15} />
            </mesh>
          ))}
        </group>
      )}
      {index === 1 && (
        <mesh position={[DOOR_WIDTH / 2 - 0.36, 0, PANEL_DEPTH / 2 + 0.015]}>
          <boxGeometry args={[0.16, 0.05, 0.03]} />
          <meshStandardMaterial color="#c9cdd1" roughness={0.3} metalness={0.7} />
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

  return (
    <group>
      <mesh position={[-jambX, y, wallZ]}>
        <boxGeometry args={[jambWidth, height, 0.4]} />
        <meshStandardMaterial color="#E4E2DC" roughness={0.9} />
      </mesh>
      <mesh position={[jambX, y, wallZ]}>
        <boxGeometry args={[jambWidth, height, 0.4]} />
        <meshStandardMaterial color="#E4E2DC" roughness={0.9} />
      </mesh>
      <mesh position={[0, DOOR_HEIGHT / 2 + (LIFT_HEIGHT + 0.6) / 2, wallZ]}>
        <boxGeometry args={[DOOR_WIDTH + jambWidth * 2, LIFT_HEIGHT + 0.6, 0.4]} />
        <meshStandardMaterial color="#E4E2DC" roughness={0.9} />
      </mesh>
    </group>
  )
}

export function GarageDoorScene({ isOpen }: { isOpen: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [3.4, 1.5, 4.6], fov: 32 }}
    >
      <ambientLight intensity={0.65} />
      <directionalLight position={[4, 6, 5]} intensity={1.1} />
      <directionalLight position={[-5, 3, -3]} intensity={0.25} />

      <Facade />
      {Array.from({ length: PANEL_COUNT }, (_, i) => (
        <Panel key={i} index={i} isOpen={isOpen} color="#2C3033" />
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#d9d5cb" roughness={1} />
      </mesh>
      <ContactShadows position={[0, FLOOR_Y + 0.005, 0]} opacity={0.45} scale={8} blur={2.4} far={3} />

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
