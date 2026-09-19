'use client'

interface AutomatedDoorsIntroProps {
  progress: number
}

export function AutomatedDoorsIntro({ progress }: AutomatedDoorsIntroProps) {
  const revealProgress = Math.max(0, Math.min(1, (progress - 0.54) / 0.32))

  return (
    <div
      className="garage-door-intro"
      style={{
        opacity: revealProgress,
        transform: `translate3d(0, ${12 - revealProgress * 12}px, 0)`,
      }}
      aria-hidden={revealProgress < 0.2}
    >
        <p>POWERED BY</p>
      <h2>
        AUTOMATED DOORS <span>&amp;</span> GATES
      </h2>
    </div>
  )
}