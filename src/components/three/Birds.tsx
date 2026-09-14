'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface BirdSpec {
  radius: number
  height: number
  speed: number
  phase: number
}

function Bird({ radius, height, speed, phase }: BirdSpec) {
  const ref = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime() * speed + phase
    ref.current.position.set(Math.cos(t) * radius, height + Math.sin(t * 2.3) * 0.15, Math.sin(t) * radius - 2)
    ref.current.rotation.y = -t + Math.PI / 2
    // A simple flap, not a real wingbeat — enough to read as alive at a distance
    const flap = Math.sin(t * 14) * 0.35
    ref.current.children[0].rotation.z = 0.35 + flap
    ref.current.children[1].rotation.z = -0.35 - flap
  })

  return (
    <group ref={ref}>
      <mesh rotation={[0, 0, 0.35]}>
        <boxGeometry args={[0.22, 0.02, 0.03]} />
        <meshBasicMaterial color="#2b2d30" toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, -0.35]} position={[0.03, 0, 0]}>
        <boxGeometry args={[0.22, 0.02, 0.03]} />
        <meshBasicMaterial color="#2b2d30" toneMapped={false} />
      </mesh>
    </group>
  )
}

// Heights and radii are deliberately modest (the camera's ~32° FOV
// framing on the door only actually shows roughly y -0.9 to y 2.3, and a
// similarly tight x range, at this distance) — birds circling at a
// realistic "over the rooftops" height or a wide, house-scale radius
// would sit outside the visible frame far more often than in it.
const FLOCK: BirdSpec[] = [
  { radius: 3.0, height: 1.85, speed: 0.15, phase: 0 },
  { radius: 2.4, height: 2.1, speed: 0.19, phase: 1.6 },
  { radius: 3.3, height: 1.65, speed: 0.13, phase: 3.4 },
]

// Small dark silhouettes drifting in slow circles above the house — pure
// ambiance, so they're cheap on purpose: unlit material (no per-frame
// lighting cost) and a handful of instances, not a flocking simulation.
export function Birds() {
  return (
    <>
      {FLOCK.map((bird, i) => (
        <Bird key={i} {...bird} />
      ))}
    </>
  )
}
