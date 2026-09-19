'use client'

import { useCallback, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

const OPEN_THRESHOLD = 0.35

interface DoorDragOptions {
  travel?: number
  onOpened?: () => void
}

export function useDoorDrag({ travel = 320, onOpened }: DoorDragOptions = {}) {
  const [progress, setProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startY = useRef(0)
  const startProgress = useRef(0)

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    startY.current = event.clientY
    startProgress.current = progress
    setIsDragging(true)
  }, [progress])

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!isDragging) return
    const next = startProgress.current + (startY.current - event.clientY) / travel
    setProgress(Math.max(0, Math.min(1, next)))
  }, [isDragging, travel])

  const finishDrag = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    setProgress((current) => {
      const next = current >= OPEN_THRESHOLD ? 1 : 0
      if (next === 1) onOpened?.()
      return next
    })
  }, [isDragging, onOpened])

  const open = useCallback(() => {
    setProgress(1)
    onOpened?.()
  }, [onOpened])

  const close = useCallback(() => {
    setProgress(0)
  }, [])

  return {
    progress,
    isDragging,
    open,
    close,
    toggle: progress > 0.5 ? close : open,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
    },
  }
}