'use client'

import { useEffect, useState } from 'react'
import { GarageDoorScene } from './GarageDoorScene'

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

// A static illustration, not a broken canvas — some phones and locked-down
// browsers genuinely don't have WebGL, and that's not worth a blank hero.
function HeroFallback() {
  return (
    <div className="relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100 via-slate-100 to-slate-200 sm:aspect-[16/10]">
      <div className="flex w-3/5 max-w-64 flex-col gap-1.5 rounded-lg border-4 border-slate-400/40 bg-slate-300/60 p-2">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="h-8 rounded-sm bg-slate-400/70 sm:h-10" />
        ))}
      </div>
      <p className="text-micro text-zinc-deep">3D preview isn&apos;t available on this device.</p>
    </div>
  )
}

// The line the door reveals. It lives here rather than inside the scene
// so the 3D code stays about geometry and lighting.
const REVEAL_HEADLINE = 'App developed for automated doors and gates.'

export function DoorHero3D() {
  const [isOpen, setIsOpen] = useState(false)
  const [supported, setSupported] = useState<boolean | null>(null)

  useEffect(() => {
    setSupported(supportsWebGL())
  }, [])

  if (supported === false) {
    return <HeroFallback />
  }

  return (
    <div className="relative aspect-[4/3] w-full touch-pan-y overflow-hidden rounded-2xl bg-gradient-to-b from-sky-100 via-slate-100 to-slate-200 sm:aspect-[16/10]">
      {supported === null ? (
        <div className="absolute inset-0 animate-pulse bg-slate-200/70" />
      ) : (
        <GarageDoorScene
          isOpen={isOpen}
          revealHeadline={REVEAL_HEADLINE}
          revealWordmark="DOORLINK"
        />
      )}

      <p className="absolute left-4 top-4 rounded-full bg-paper/80 px-3 py-1 text-micro font-medium text-graphite-soft backdrop-blur">
        Drag to look around
      </p>

      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        // Bottom-right, not centred: centred, it sat straight across the
        // line the door reveals.
        className="absolute bottom-4 right-4 rounded-full bg-graphite/90 px-5 py-2.5 text-sm font-medium text-paper shadow-lg backdrop-blur transition hover:bg-graphite"
      >
        {isOpen ? 'Close the door' : 'Open the door'}
      </button>
    </div>
  )
}
