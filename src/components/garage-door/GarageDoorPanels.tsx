'use client'

const PANEL_COUNT = 4

interface GarageDoorPanelsProps {
  progress: number
}

export function GarageDoorPanels({ progress }: GarageDoorPanelsProps) {
  return (
    <div className="garage-door-panels" aria-hidden="true">
      {Array.from({ length: PANEL_COUNT }, (_, index) => {
        const articulation = progress * (index + 1) * 8
        const lift = progress * (230 + index * 12)
        return (
          <div
            key={index}
            className="garage-door-panel"
            style={{
              transform: `translate3d(0, -${lift}px, 0) rotateX(${articulation}deg)`,
            }}
          >
            <span className="garage-door-panel-groove" />
            <span className="garage-door-panel-highlight" />
            {index === PANEL_COUNT - 1 && <span className="garage-door-led" />}
          </div>
        )
      })}
    </div>
  )
}