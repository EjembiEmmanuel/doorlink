'use client'

import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * The inside of the garage, and the line the opening door reveals.
 *
 * The reveal is drawn *inside the scene* rather than layered over the
 * canvas, so the door panels genuinely occlude it on the way up and the
 * orbiting camera gives it real parallax against the facade. An HTML
 * overlay could not be hidden behind the door — it would sit on top of
 * it, which is exactly the "cheap popup" the brief rules out.
 *
 * The text is painted to a 2D canvas and used as a texture rather than
 * loaded through a 3D text library: troika (what drei's <Text> uses)
 * fetches its default typeface from a font CDN at runtime, and a hero
 * that silently loses its headline when a request is blocked is not a
 * hero. Painting it locally also sets it in the typeface the rest of the
 * site is already using.
 */

function useTextTexture(
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number, fontFamily: string) => void,
  width: number,
  height: number
) {
  const { gl } = useThree()

  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Borrow whatever the document is actually rendering in, so the
    // reveal is set in the same typeface as the rest of Doorlink.
    const fontFamily =
      typeof window !== 'undefined'
        ? getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif'
        : 'system-ui, sans-serif'

    draw(ctx, width, height, fontFamily)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = gl.capabilities.getMaxAnisotropy()
    texture.needsUpdate = true
    return texture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height])
}

/** Wraps text to a pixel width and returns the lines. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

export interface GarageInteriorProps {
  isOpen: boolean
  /** Where the back of the garage sits, so the sign can hang on it. */
  backWallZ: number
  /** The plane of the facade, where the room's front edge meets it. */
  frontZ: number
  floorY: number
  ceilingY: number
  doorWidth: number
  headline: string
  wordmark: string
}

export function GarageInterior({
  isOpen,
  backWallZ,
  frontZ,
  floorY,
  ceilingY,
  doorWidth,
  headline,
  wordmark,
}: GarageInteriorProps) {
  const headlineRef = useRef<THREE.Group>(null)
  const wordmarkRef = useRef<THREE.Group>(null)
  const glowRef = useRef<THREE.PointLight>(null)
  const progress = useRef(0)

  const headlineTexture = useTextTexture(
    (ctx, width, height, fontFamily) => {
      ctx.clearRect(0, 0, width, height)
      ctx.font = `600 ${Math.round(height * 0.2)}px ${fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#F5F7F9'

      const lines = wrap(ctx, headline, width * 0.9)
      const lineHeight = height * 0.26
      const start = height / 2 - ((lines.length - 1) * lineHeight) / 2
      lines.forEach((line, index) => {
        ctx.fillText(line, width / 2, start + index * lineHeight)
      })
    },
    1536,
    512
  )

  const wordmarkTexture = useTextTexture(
    (ctx, width, height, fontFamily) => {
      ctx.clearRect(0, 0, width, height)
      ctx.font = `600 ${Math.round(height * 0.6)}px ${fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      // Deliberately dim: this layer sits furthest back and exists to
      // give the headline something to parallax against, not to compete
      // with it.
      ctx.fillStyle = 'rgba(214, 229, 244, 0.34)'
      ctx.letterSpacing = `${Math.round(height * 0.05)}px`
      ctx.fillText(wordmark, width / 2, height / 2)
    },
    1024,
    256
  )

  const roomWidth = doorWidth + 0.24
  const roomDepth = frontZ - backWallZ
  const roomHeight = ceilingY - floorY
  const midZ = (frontZ + backWallZ) / 2

  const headlineWidth = doorWidth * 0.9
  const headlineHeight = (headlineWidth * 512) / 1536
  const wordmarkWidth = doorWidth * 0.46
  const wordmarkHeight = (wordmarkWidth * 256) / 1024

  const headlineRestY = floorY + roomHeight * 0.44
  // Sits clear of the opener motor, which hangs centre-front.
  const wordmarkRestY = floorY + roomHeight * 0.655
  // The headline hangs forward of the back wall. That gap is the whole
  // point: it is what makes the two lines separate as the camera orbits.
  const headlineZ = backWallZ + roomDepth * 0.42

  useFrame((_, delta) => {
    // Trails the door rather than matching it: the words arrive as the
    // opening finishes, not while the panels are still in the way.
    const target = isOpen ? 1 : 0
    const rate = isOpen ? 2 : 5.5
    progress.current = THREE.MathUtils.damp(progress.current, target, rate, delta)
    const eased = progress.current

    if (headlineRef.current) {
      headlineRef.current.position.y = headlineRestY - (1 - eased) * 0.3
      const material = (headlineRef.current.children[0] as THREE.Mesh)?.material as THREE.MeshBasicMaterial
      if (material) material.opacity = Math.max(0, eased * 1.3 - 0.3)
    }

    if (wordmarkRef.current) {
      // The back layer moves less, which is what makes the two read as
      // being at different depths when the camera moves.
      wordmarkRef.current.position.y = wordmarkRestY - (1 - eased) * 0.12
      const material = (wordmarkRef.current.children[0] as THREE.Mesh)?.material as THREE.MeshBasicMaterial
      if (material) material.opacity = Math.max(0, eased * 0.95 - 0.25)
    }

    if (glowRef.current) {
      glowRef.current.intensity = eased * 7
    }
  })

  if (!headlineTexture || !wordmarkTexture) return null

  const shell = <meshStandardMaterial color="#45484b" roughness={0.95} side={THREE.DoubleSide} />

  return (
    <group>
      {/* A real room, not a billboard. Without floor, side walls and a
          ceiling the open shot looks into a void and the sign reads as
          a card floating in mid-air. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY + 0.002, midZ]} receiveShadow>
        <planeGeometry args={[roomWidth, roomDepth]} />
        <meshStandardMaterial color="#54585c" roughness={0.98} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ceilingY, midZ]} receiveShadow>
        <planeGeometry args={[roomWidth, roomDepth]} />
        {shell}
      </mesh>
      <mesh
        rotation={[0, Math.PI / 2, 0]}
        position={[-roomWidth / 2, floorY + roomHeight / 2, midZ]}
        receiveShadow
      >
        <planeGeometry args={[roomDepth, roomHeight]} />
        {shell}
      </mesh>
      <mesh
        rotation={[0, -Math.PI / 2, 0]}
        position={[roomWidth / 2, floorY + roomHeight / 2, midZ]}
        receiveShadow
      >
        <planeGeometry args={[roomDepth, roomHeight]} />
        {shell}
      </mesh>
      <mesh position={[0, floorY + roomHeight / 2, backWallZ]} receiveShadow>
        <planeGeometry args={[roomWidth, roomHeight]} />
        <meshStandardMaterial color="#42464a" roughness={0.94} />
      </mesh>

      <group ref={wordmarkRef} position={[0, wordmarkRestY, backWallZ + 0.02]}>
        <mesh>
          <planeGeometry args={[wordmarkWidth, wordmarkHeight]} />
          <meshBasicMaterial
            map={wordmarkTexture}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      <group ref={headlineRef} position={[0, headlineRestY, headlineZ]}>
        <mesh>
          <planeGeometry args={[headlineWidth, headlineHeight]} />
          <meshBasicMaterial
            map={headlineTexture}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* A soft interior light that comes up with the door, so the reveal
          reads as the garage lighting waking rather than a caption
          switching on. */}
      <pointLight
        ref={glowRef}
        position={[0, ceilingY - 0.25, midZ]}
        intensity={0}
        distance={7}
        decay={2}
        color="#e2edf8"
      />
    </group>
  )
}
