'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, OrbitControls, RoundedBox, Sky } from '@react-three/drei'
import { EffectComposer, DepthOfField, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { House } from './House'
import { Garden } from './Garden'
import { Birds } from './Birds'

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
const SUN_POSITION: [number, number, number] = [8, 5, 6]
const JAMB_WIDTH = 0.3
const WALL_Z = PANEL_DEPTH / 2 + 0.03
const WALL_TOP_Y = DOOR_HEIGHT / 2 + (LIFT_HEIGHT + 0.6)

function SunGlow() {
  const direction = new THREE.Vector3(...SUN_POSITION).normalize().multiplyScalar(40)
  return (
    <mesh position={direction.toArray()}>
      <sphereGeometry args={[2.2, 16, 16]} />
      <meshBasicMaterial color="#fff6dd" toneMapped={false} />
    </mesh>
  )
}

// Mounted just below the header's bottom edge so it's naturally occluded
// by the closed door (same z-depth trick the header itself uses to hide
// raised panels) and only comes into view through the opening once the
// door lifts — a real garage always has one of these, and its absence
// was the single biggest tell that the "open" shot was an empty box.
function GarageDoorOpener() {
  const railY = DOOR_HEIGHT / 2 - 0.05
  const railLength = 2.2
  const frontZ = WALL_Z - 0.15
  const ceilingY = railY + 0.5
  return (
    <group>
      {/* A visible interior ceiling gives the rail and motor something to
          hang from — without it they read as floating in an empty void
          rather than mounted inside an actual room. */}
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, ceilingY, frontZ - railLength / 2 - 0.2]}
        receiveShadow
      >
        <planeGeometry args={[3.4, railLength + 1]} />
        <meshStandardMaterial color="#c7c9cc" roughness={1} />
      </mesh>

      <mesh position={[0, railY, frontZ - railLength / 2]} castShadow>
        <boxGeometry args={[0.1, 0.1, railLength]} />
        <meshStandardMaterial color="#26282a" roughness={0.5} metalness={0.4} envMapIntensity={0.6} />
      </mesh>
      <mesh position={[0, railY - 0.18, frontZ - 0.28]} castShadow>
        <boxGeometry args={[0.46, 0.28, 0.55]} />
        <meshStandardMaterial color="#dcdcda" roughness={0.6} metalness={0.1} />
      </mesh>
      {[-0.7, 0].map((offset) => (
        <mesh key={offset} position={[0, (railY + ceilingY) / 2, frontZ + offset]}>
          <boxGeometry args={[0.05, ceilingY - railY, 0.05]} />
          <meshStandardMaterial color="#5a5d60" roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

function HardwareBracket({ x }: { x: number }) {
  return (
    <group position={[x, 0, PANEL_DEPTH / 2 + 0.006]}>
      <mesh castShadow>
        <boxGeometry args={[0.1, 0.08, 0.018]} />
        <meshStandardMaterial color="#b7bbc0" roughness={0.35} metalness={0.75} envMapIntensity={1.2} />
      </mesh>
      <mesh position={[0, 0, 0.013]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.026, 0.026, 0.026, 16]} />
        <meshStandardMaterial color="#8a8e93" roughness={0.22} metalness={0.85} envMapIntensity={1.4} />
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

  // Real sectional doors are stamped, not flat — a raised rectangular
  // field inset from the stile/rail border is the classic "raised panel"
  // profile, and it's built as actual geometry here so real shadow
  // mapping defines its edges, rather than a painted-on line.
  const embossWidth = DOOR_WIDTH - 0.34
  const embossHeight = PANEL_HEIGHT - 0.14

  return (
    <group ref={ref} position={[0, restY, 0]}>
      <RoundedBox args={[DOOR_WIDTH, PANEL_HEIGHT, PANEL_DEPTH]} radius={0.016} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.16} envMapIntensity={0.5} />
      </RoundedBox>

      <RoundedBox
        args={[embossWidth, embossHeight, 0.03]}
        radius={0.014}
        smoothness={3}
        position={[0, 0, PANEL_DEPTH / 2 + 0.014]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={color} roughness={0.48} metalness={0.2} envMapIntensity={0.6} />
      </RoundedBox>

      {/* Panel-to-panel seam highlight, the one real horizontal joint a stacked sectional door actually has */}
      <mesh position={[0, PANEL_HEIGHT / 2 - 0.01, PANEL_DEPTH / 2 + 0.002]}>
        <boxGeometry args={[DOOR_WIDTH, 0.014, 0.008]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.28} />
      </mesh>

      {index === PANEL_COUNT - 1 && (
        <group position={[0, 0, PANEL_DEPTH / 2 + 0.014 + 0.016]}>
          {[-1, -0.34, 0.34, 1].map((x) => (
            <mesh key={x} position={[x * (DOOR_WIDTH / 2 - 0.52), 0, 0]}>
              <planeGeometry args={[0.4, embossHeight - 0.14]} />
              <meshPhysicalMaterial
                color="#dce6f0"
                emissive="#bcd3e6"
                emissiveIntensity={0.4}
                roughness={0.04}
                metalness={0}
                clearcoat={1}
                transmission={0.3}
                envMapIntensity={1.5}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* Roller/hinge hardware sits on the flat stile outside the raised field, not on top of it */}
      <HardwareBracket x={-DOOR_WIDTH / 2 + 0.1} />
      <HardwareBracket x={DOOR_WIDTH / 2 - 0.1} />

      {index === 1 && (
        <mesh position={[DOOR_WIDTH / 2 - 0.74, 0, PANEL_DEPTH / 2 + 0.014 + 0.02]} castShadow>
          <boxGeometry args={[0.16, 0.05, 0.035]} />
          <meshStandardMaterial color="#c9cdd1" roughness={0.22} metalness={0.82} envMapIntensity={1.3} />
        </mesh>
      )}
    </group>
  )
}

function Facade() {
  const height = DOOR_HEIGHT + LIFT_HEIGHT + 0.6
  const y = FLOOR_Y + height / 2
  const jambX = DOOR_WIDTH / 2 + JAMB_WIDTH / 2
  const wallMaterial = <meshStandardMaterial color="#E4E2DC" roughness={0.94} envMapIntensity={0.35} />

  return (
    <group>
      <mesh position={[-jambX, y, WALL_Z]} castShadow receiveShadow>
        <boxGeometry args={[JAMB_WIDTH, height, 0.4]} />
        {wallMaterial}
      </mesh>
      <mesh position={[jambX, y, WALL_Z]} castShadow receiveShadow>
        <boxGeometry args={[JAMB_WIDTH, height, 0.4]} />
        {wallMaterial}
      </mesh>
      <mesh position={[0, WALL_TOP_Y - (LIFT_HEIGHT + 0.6) / 2, WALL_Z]} castShadow receiveShadow>
        <boxGeometry args={[DOOR_WIDTH + JAMB_WIDTH * 2, LIFT_HEIGHT + 0.6, 0.4]} />
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
      gl={{ antialias: true }}
      camera={{ position: [3.4, 1.5, 4.6], fov: 32 }}
    >
      <Sky sunPosition={SUN_POSITION} turbidity={4} rayleigh={1.2} mieCoefficient={0.02} mieDirectionalG={0.9} />
      <SunGlow />
      <Birds />
      <fog attach="fog" args={['#cfd8e3', 9, 21]} />

      {/* Baked once (frames=1), not per-frame — gives the dark steel and
          hardware real sky-tinted reflections instead of flat diffuse
          color, without any external HDR asset or per-frame render cost. */}
      <Environment resolution={128} frames={1}>
        <Sky sunPosition={SUN_POSITION} turbidity={4} rayleigh={1.2} mieCoefficient={0.02} mieDirectionalG={0.9} />
      </Environment>

      <ambientLight intensity={0.22} />
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
      <directionalLight position={[-5, 3, -3]} intensity={0.28} color="#cbd9ff" />

      <Facade />
      <House jambOuterX={DOOR_WIDTH / 2 + JAMB_WIDTH} wallTopY={WALL_TOP_Y} wallZ={WALL_Z} floorY={FLOOR_Y} doorWidth={DOOR_WIDTH} />
      <GarageDoorOpener />
      {Array.from({ length: PANEL_COUNT }, (_, i) => (
        <Panel key={i} index={i} isOpen={isOpen} color="#2C3033" />
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} receiveShadow>
        <planeGeometry args={[16, 16]} />
        <meshStandardMaterial color="#d9d5cb" roughness={0.96} envMapIntensity={0.25} />
      </mesh>
      <Garden doorWidth={DOOR_WIDTH} floorY={FLOOR_Y} wallZ={WALL_Z} />

      {/* Tone mapping deliberately lives here, last in the effect chain,
          instead of on the renderer (gl.toneMapping) — the renderer's own
          tone mapping runs before DepthOfField captures the scene, which
          clamps bright pixels to 0-1 first and makes the sky/sun bloom
          into a blown-out white smear once blurred. Applying it after
          DoF keeps the blur working on proper HDR data. */}
      <EffectComposer>
        <DepthOfField focusDistance={5.7} focusRange={5.5} bokehScale={1.5} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>

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
