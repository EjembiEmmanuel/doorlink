'use client'

import { useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, OrbitControls, RoundedBox, Sky } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { EffectComposer, DepthOfField, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { House } from './House'
import { Garden } from './Garden'
import { Birds } from './Birds'
import { GarageInterior } from './GarageInterior'

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
// The back of the garage. Deep enough that the headline and the wordmark
// sit at visibly different distances from the camera, which is what
// produces parallax between them as the view orbits.
const BACK_WALL_Z = WALL_Z - 3.1
// Matches the rail/motor mount so the opener hangs from a real ceiling.
const CEILING_Y = DOOR_HEIGHT / 2 + 0.45

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
  // Hung close under the ceiling, where a real opener actually mounts.
  // It used to sit lower, where it cut across the line the door reveals.
  const railY = CEILING_Y - 0.3
  const railLength = 2.2
  const frontZ = WALL_Z - 0.15
  const ceilingY = CEILING_Y
  return (
    <group>
      {/* The ceiling itself is part of GarageInterior now — the rail and
          motor just hang from it. */}
      <mesh position={[0, railY, frontZ - railLength / 2]} castShadow>
        <boxGeometry args={[0.1, 0.1, railLength]} />
        <meshStandardMaterial color="#26282a" roughness={0.5} metalness={0.4} envMapIntensity={0.6} />
      </mesh>
      <mesh position={[0, railY - 0.14, frontZ - 0.28]} castShadow>
        <boxGeometry args={[0.42, 0.24, 0.5]} />
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


/**
 * The camera half of the reveal.
 *
 * While the door is shut the view drifts slowly around the facade. As it
 * opens, the allowed azimuth range closes in on straight-on — which
 * carries the camera there without wresting control away, because a
 * person mid-drag keeps dragging, just within a narrowing arc. Closing
 * the door relaxes the range and the drift resumes.
 *
 * Done this way rather than by animating the camera directly so that the
 * user's own input and the reveal never fight over the same value.
 */
const CLOSED_RADIUS = 5.8
// Pulls back rather than pushing in: the reveal is the point, but so is
// the house it is set in, and filling the frame with the opening throws
// the property away.
const OPEN_RADIUS = 7.4

function CameraDirector({ isOpen }: { isOpen: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const closeness = useRef(0)
  const { camera } = useThree()

  useFrame((_, delta) => {
    const instance = controls.current
    if (!instance) return

    closeness.current = THREE.MathUtils.damp(closeness.current, isOpen ? 1 : 0, 1.8, delta)
    const t = closeness.current

    const target = instance.target
    const offset = camera.position.clone().sub(target)
    const desired = THREE.MathUtils.lerp(CLOSED_RADIUS, OPEN_RADIUS, t)
    offset.setLength(THREE.MathUtils.damp(offset.length(), desired, 2.4, delta))
    camera.position.copy(target).add(offset)

    const openArc = THREE.MathUtils.lerp(Math.PI / 2.3, 0.2, t)
    instance.minAzimuthAngle = -openArc
    instance.maxAzimuthAngle = openArc

    // Level out a little too: looking slightly down into the garage reads
    // better than looking up at the lintel.
    instance.minPolarAngle = THREE.MathUtils.lerp(Math.PI / 2 - 0.45, Math.PI / 2 - 0.26, t)
    instance.maxPolarAngle = THREE.MathUtils.lerp(Math.PI / 2 + 0.12, Math.PI / 2 + 0.02, t)
    instance.autoRotateSpeed = 0.6 * (1 - t)
    instance.update()
  })

  return (
    <OrbitControls
      ref={controls}
      target={[0, 0.55, 0]}
      enablePan={false}
      enableZoom={false}
      autoRotate
      autoRotateSpeed={0.6}
      enableDamping
      dampingFactor={0.08}
    />
  )
}

export interface GarageDoorSceneProps {
  isOpen: boolean
  /** The line the opening door reveals. Passed in so the scene stays a
   *  scene and the copy stays with the page that owns it. */
  revealHeadline: string
  revealWordmark: string
}

export function GarageDoorScene({ isOpen, revealHeadline, revealWordmark }: GarageDoorSceneProps) {
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
      <GarageInterior
        isOpen={isOpen}
        backWallZ={BACK_WALL_Z}
        frontZ={WALL_Z}
        floorY={FLOOR_Y}
        ceilingY={CEILING_Y}
        doorWidth={DOOR_WIDTH}
        headline={revealHeadline}
        wordmark={revealWordmark}
      />
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

      <CameraDirector isOpen={isOpen} />
    </Canvas>
  )
}
