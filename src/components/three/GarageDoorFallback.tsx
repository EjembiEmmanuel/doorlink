'use client'

import { useRef } from 'react'

interface GarageDoorFallbackProps {
  isOpen: boolean
  onToggle: () => void
}

/**
 * A lightweight CSS scene for devices that cannot create WebGL.
 *
 * This is intentionally an interaction, not a static error state: the
 * fallback keeps the product's opening-door identity on older phones and
 * privacy-hardened browsers without adding another rendering dependency.
 */
export function GarageDoorFallback({ isOpen, onToggle }: GarageDoorFallbackProps) {
  const pointerStart = useRef<number | null>(null)

  return (
    <div
      className="garage-fallback"
      onPointerDown={(event) => {
        pointerStart.current = event.clientY
      }}
      onPointerUp={(event) => {
        if (pointerStart.current === null) return
        const distance = event.clientY - pointerStart.current
        pointerStart.current = null
        if (distance < -28 && !isOpen) onToggle()
        if (distance > 28 && isOpen) onToggle()
      }}
      onPointerCancel={() => {
        pointerStart.current = null
      }}
    >
      <div className="garage-fallback-sky" aria-hidden="true" />
      <div className="garage-fallback-house" aria-hidden="true">
        <div className="garage-fallback-roof" />
        <div className="garage-fallback-window garage-fallback-window-left" />
        <div className="garage-fallback-window garage-fallback-window-right" />
        <div className="garage-fallback-wall" />
        <div className="garage-fallback-drive" />
      </div>

      <div className={`garage-fallback-interior ${isOpen ? 'is-visible' : ''}`}>
        <span className="garage-fallback-wordmark">DOORLINK</span>
        <strong>ALL DEVELOPED FOR<br />AUTOMATED DOORS &amp; GATES</strong>
        <span className="garage-fallback-status">CONNECTED TRADE PLATFORM</span>
      </div>

      <div className={`garage-fallback-door ${isOpen ? 'is-open' : ''}`} aria-hidden="true">
        {[0, 1, 2, 3].map((panel) => (
          <span key={panel} className="garage-fallback-panel">
            <span className="garage-fallback-panel-inset" />
          </span>
        ))}
      </div>

      <div className="garage-fallback-controls">
        <span className="garage-fallback-hint">{isOpen ? 'Entrance open' : 'Slide to open'}</span>
        <button type="button" onClick={onToggle} className="garage-fallback-button">
          {isOpen ? 'Close door' : 'Open door'}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
      <span className="garage-fallback-note">Lightweight preview for this device</span>
    </div>
  )
}