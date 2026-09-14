'use client'

import { useEffect, useState } from 'react'

const DISMISSED_KEY = 'doorlink-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

function dismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // Private browsing or blocked storage — the banner just reappears
    // next visit, not worth failing over.
  }
}

// Chrome/Android fire beforeinstallprompt and let us trigger the native
// install flow directly. iOS Safari has no such event or API — "Add to
// Home Screen" only exists in the manual Share sheet — so the best this
// can honestly do there is point at it, not claim to trigger it.
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissedNow, setDismissedNow] = useState(false)

  useEffect(() => {
    if (isStandalone() || dismissed()) return

    if (isIos()) {
      setShowIosHint(true)
      return
    }

    function handler(event: Event) {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (dismissedNow || (!deferredPrompt && !showIosHint)) return null

  function handleDismiss() {
    dismiss()
    setDismissedNow(true)
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    dismiss()
  }

  return (
    <div className="fixed inset-x-0 bottom-16 z-20 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3 shadow-lg sm:bottom-4 sm:left-4 sm:right-auto sm:mx-0">
      {showIosHint ? (
        <p className="text-sm text-graphite">
          Install Doorlink: tap <span className="font-medium">Share</span>, then{' '}
          <span className="font-medium">Add to Home Screen</span>.
        </p>
      ) : (
        <>
          <p className="text-sm text-graphite">Install Doorlink for quicker, full-screen access.</p>
          <button
            type="button"
            onClick={handleInstall}
            className="shrink-0 rounded-full bg-signal px-3 py-1.5 text-sm font-medium text-paper hover:bg-signal-hover"
          >
            Install
          </button>
        </>
      )}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-zinc-deep hover:text-graphite"
      >
        ✕
      </button>
    </div>
  )
}
