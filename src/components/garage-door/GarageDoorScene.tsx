'use client'

import { AutomatedDoorsIntro } from './AutomatedDoorsIntro'
import { GarageDoorPanels } from './GarageDoorPanels'

interface GarageDoorSceneProps {
  progress: number
  isDragging: boolean
  dragHandlers: {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void
    onPointerUp: () => void
    onPointerCancel: () => void
  }
}

export function GarageDoorScene({ progress, isDragging, dragHandlers }: GarageDoorSceneProps) {
  return (
    <div
      className={`garage-door-scene ${isDragging ? 'is-dragging' : ''}`}
      {...dragHandlers}
      role="group"
      aria-label="Interactive automated garage door"
    >
      <div className="garage-door-skyline" aria-hidden="true" />
      <div className="garage-door-sun" aria-hidden="true" />
      <div className="garage-door-birds" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="garage-door-bushes" aria-hidden="true">
        <span className="garage-door-bush garage-door-bush-left" />
        <span className="garage-door-bush garage-door-bush-center" />
        <span className="garage-door-bush garage-door-bush-right" />
      </div>
      <div className="garage-door-opening">
        <div className="garage-door-shadow" aria-hidden="true" />
        <div className="garage-door-back-wall" aria-hidden="true" />
        <AutomatedDoorsIntro progress={progress} />
        <GarageDoorPanels progress={progress} />
        <div className="garage-door-floor" aria-hidden="true" />
      </div>
      <div className="garage-door-light" aria-hidden="true" />
      <p className={`garage-door-hint ${isDragging ? 'is-hidden' : ''}`}>
        DRAG UP TO OPEN
      </p>
    </div>
  )
}