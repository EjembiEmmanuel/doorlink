'use client'

const HOUSE_COLOR = '#E4E2DC'
const ROOF_COLOR = '#5B4636'

function HouseWindow({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.9, 1.1, 0.08]} />
        <meshStandardMaterial color="#FAFAF9" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[0.72, 0.92]} />
        <meshPhysicalMaterial color="#bcd3e6" roughness={0.05} metalness={0} transmission={0.5} clearcoat={1} envMapIntensity={1.2} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.04, 0.92, 0.02]} />
        <meshStandardMaterial color="#FAFAF9" />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.72, 0.04, 0.02]} />
        <meshStandardMaterial color="#FAFAF9" />
      </mesh>
    </group>
  )
}

// The garage door's own jambs/header (drawn separately, right around the
// opening, at the same wallZ) already hide the panels when open and give
// the door a tight, recessed-into-the-wall look — this is the *rest* of
// the house around that: two wing walls starting just outside the jambs
// (never overlapping the door's own footprint, so there's no z-fighting
// between the two), a pitched roof spanning the full width above both,
// a couple of windows, and a chimney.
export function House({
  doorWidth,
  jambOuterX,
  wallTopY,
  wallZ,
  floorY,
}: {
  doorWidth: number
  jambOuterX: number
  wallTopY: number
  wallZ: number
  floorY: number
}) {
  const houseHalfWidth = doorWidth / 2 + 2.0
  const overhang = 0.4
  const roofRun = houseHalfWidth + overhang
  const pitch = 0.38
  const roofRise = roofRun * Math.tan(pitch)
  const slabLength = roofRun / Math.cos(pitch)
  const roofDepth = 3.2
  const roofThickness = 0.08
  const wingWidth = houseHalfWidth - jambOuterX
  const wingCenterX = jambOuterX + wingWidth / 2

  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh
          key={`wing-${side}`}
          position={[side * wingCenterX, floorY + (wallTopY - floorY) / 2, wallZ]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wingWidth, wallTopY - floorY, 0.4]} />
          <meshStandardMaterial color={HOUSE_COLOR} roughness={0.94} envMapIntensity={0.3} />
        </mesh>
      ))}

      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (roofRun / 2), wallTopY + roofRise / 2, wallZ]}
          rotation={[0, 0, side * -pitch]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[slabLength, roofThickness, roofDepth]} />
          <meshStandardMaterial color={ROOF_COLOR} roughness={0.8} envMapIntensity={0.25} />
        </mesh>
      ))}

      <HouseWindow x={-(doorWidth / 2 + 1.05)} y={1.15} z={wallZ + 0.22} />
      <HouseWindow x={doorWidth / 2 + 1.05} y={1.15} z={wallZ + 0.22} />

      <mesh position={[houseHalfWidth * 0.55, wallTopY + roofRise + 0.55, wallZ - 0.7]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 1.5, 0.4]} />
        <meshStandardMaterial color="#8a6f5c" roughness={0.9} envMapIntensity={0.2} />
      </mesh>
    </group>
  )
}
