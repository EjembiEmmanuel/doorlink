'use client'

import { useEffect } from 'react'

// Registered only in production — in dev, a service worker fighting with
// Fast Refresh over caching is a worse trade than not having one.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installability is a nice-to-have, not a dependency — the site
      // works the same without it.
    })
  }, [])

  return null
}
