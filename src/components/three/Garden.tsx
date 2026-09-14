'use client'

const LAWN_GREENS = ['#5f8f4a', '#578548']

function Lawn({ centerX, floorY }: { centerX: number; floorY: number }) {
  const stripeWidth = 1.0
  const stripeCount = 8
  return (
    <group>
      {Array.from({ length: stripeCount }, (_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[centerX, floorY + 0.003, -8 + i * stripeWidth + stripeWidth / 2]}
          receiveShadow
        >
          <planeGeometry args={[8, stripeWidth]} />
          <meshStandardMaterial color={LAWN_GREENS[i % 2]} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function Bush({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  const lumps: [number, number, number, number, string][] = [
    [0, 0.3, 0, 0.34, '#4f7a3d'],
    [0.24, 0.22, 0.14, 0.24, '#5a8a46'],
    [-0.2, 0.2, -0.1, 0.22, '#537f42'],
    [0.05, 0.42, -0.05, 0.2, '#6b9e56'],
  ]
  return (
    <group position={[x, 0, z]} scale={scale}>
      {lumps.map(([lx, ly, lz, r, color]) => (
        <mesh key={`${lx}-${ly}-${lz}`} position={[lx, ly, lz]} castShadow receiveShadow>
          <sphereGeometry args={[r, 10, 8]} />
          <meshStandardMaterial color={color} roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}

// A low, clipped foundation hedge running along the base of the house —
// the single most common "someone actually landscaped this" cue a real
// front yard has, and one the garden was missing entirely.
function Hedge({ x, z, length }: { x: number; z: number; length: number }) {
  return (
    <mesh position={[x, 0.22, z]} castShadow receiveShadow>
      <boxGeometry args={[length, 0.42, 0.4]} />
      <meshStandardMaterial color="#4c7a3f" roughness={0.95} />
    </mesh>
  )
}

function FlowerRow({ startX, z, count, spacing }: { startX: number; z: number; count: number; spacing: number }) {
  const colors = ['#e15c6d', '#f2c14e', '#e8e8e8', '#d1477a']
  return (
    <group position={[startX, 0.44, z]}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} position={[i * spacing, 0, 0]} castShadow>
          <sphereGeometry args={[0.05, 8, 6]} />
          <meshStandardMaterial color={colors[i % colors.length]} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

function Tree({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  const canopy: [number, number, number, number][] = [
    [0, 2.1, 0, 0.75],
    [0.4, 1.85, 0.25, 0.55],
    [-0.35, 1.9, -0.2, 0.58],
    [0.1, 2.5, -0.15, 0.5],
  ]
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.1, 0.15, 1.7, 8]} />
        <meshStandardMaterial color="#5b4636" roughness={0.9} />
      </mesh>
      {canopy.map(([cx, cy, cz, r]) => (
        <mesh key={`${cx}-${cy}-${cz}`} position={[cx, cy, cz]} castShadow receiveShadow>
          <sphereGeometry args={[r, 10, 8]} />
          <meshStandardMaterial color="#4a7539" roughness={0.95} />
        </mesh>
      ))}
    </group>
  )
}

// A driveway apron is already drawn as the main concrete floor plane in
// GarageDoorScene — this adds a mowed-stripe lawn either side of it
// (slightly raised to avoid z-fighting with the concrete beneath), a
// foundation hedge and flower row hugging the house wall, layered
// bushes, and a couple of trees for scale and depth, since a garage door
// photographed alone on its driveway reads as a warehouse, not a home.
//
// Everything here stays close to the house wall (wallZ), not out toward
// the camera — an earlier pass drifted landscaping forward to z~1-1.5,
// which (at this camera's fairly tight framing on the door) made them
// loom oversized and get cropped at the frame edges instead of reading
// as modest background planting.
export function Garden({ doorWidth, floorY, wallZ }: { doorWidth: number; floorY: number; wallZ: number }) {
  const drivewayHalfWidth = doorWidth / 2 + 0.6
  const hedgeX = drivewayHalfWidth + 0.15
  const hedgeZ = wallZ + 0.25

  return (
    <group>
      <Lawn centerX={-6} floorY={floorY} />
      <Lawn centerX={6} floorY={floorY} />

      <Hedge x={-hedgeX} z={hedgeZ} length={1.0} />
      <Hedge x={hedgeX} z={hedgeZ} length={1.0} />
      <FlowerRow startX={-hedgeX - 0.55} z={hedgeZ + 0.18} count={4} spacing={0.2} />
      <FlowerRow startX={hedgeX - 0.2} z={hedgeZ + 0.18} count={4} spacing={0.2} />

      <Bush x={-(drivewayHalfWidth + 0.3)} z={wallZ + 0.4} scale={0.85} />
      <Bush x={drivewayHalfWidth + 0.3} z={wallZ + 0.4} scale={0.85} />

      <Tree x={-4.4} z={-1.2} scale={1.1} />
      <Tree x={4.8} z={-0.6} scale={0.95} />
    </group>
  )
}
