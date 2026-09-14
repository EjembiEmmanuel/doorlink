'use client'

function Bush({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.32, 12, 10]} />
        <meshStandardMaterial color="#4f7a3d" roughness={0.95} />
      </mesh>
      <mesh position={[0.22, 0.2, 0.12]} castShadow receiveShadow>
        <sphereGeometry args={[0.22, 10, 8]} />
        <meshStandardMaterial color="#5a8a46" roughness={0.95} />
      </mesh>
    </group>
  )
}

function FlowerCluster({ x, z }: { x: number; z: number }) {
  const colors = ['#e15c6d', '#f2c14e', '#e8e8e8']
  return (
    <group position={[x, 0.12, z]}>
      {colors.map((c, i) => (
        <mesh key={c} position={[(i - 1) * 0.1, 0, 0]} castShadow>
          <sphereGeometry args={[0.055, 8, 6]} />
          <meshStandardMaterial color={c} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

// A driveway apron is already drawn as the main concrete floor plane in
// GarageDoorScene — this adds lawn either side of it (slightly raised to
// avoid z-fighting with the concrete beneath) plus a couple of bushes and
// flower beds, since a garage door photographed on its own driveway with
// nothing either side reads as a warehouse, not a home.
export function Garden({ doorWidth, floorY }: { doorWidth: number; floorY: number }) {
  const drivewayHalfWidth = doorWidth / 2 + 0.6

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-6, floorY + 0.003, 0]} receiveShadow>
        <planeGeometry args={[8, 16]} />
        <meshStandardMaterial color="#5f8f4a" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6, floorY + 0.003, 0]} receiveShadow>
        <planeGeometry args={[8, 16]} />
        <meshStandardMaterial color="#5f8f4a" roughness={1} />
      </mesh>

      <Bush x={-(drivewayHalfWidth + 0.5)} z={0.6} scale={1.1} />
      <Bush x={-(drivewayHalfWidth + 1.15)} z={0.9} scale={0.85} />
      <Bush x={drivewayHalfWidth + 0.5} z={0.6} scale={1.1} />
      <Bush x={drivewayHalfWidth + 1.15} z={0.9} scale={0.85} />

      <FlowerCluster x={-(drivewayHalfWidth + 0.3)} z={1.3} />
      <FlowerCluster x={drivewayHalfWidth + 0.3} z={1.3} />
    </group>
  )
}
