'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'

interface MenuLink {
  href: string
  label: string
}

// Everything that used to be a flat row of extra header links (Cart, My
// listings, Requests, Account, Support, Admin) now lives behind one
// "signed in as" trigger — the public nav (Find, Marketplace, etc.) stays
// visible at all times, but a signed-in account's own destinations don't
// compete with it for the same row.
export function AccountMenu({
  name,
  links,
  signOutAction,
}: {
  name: string
  links: MenuLink[]
  signOutAction: (formData: FormData) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const initial = name.trim().charAt(0).toUpperCase() || '?'

  return (
    <div ref={containerRef} className="relative border-l border-line pl-6">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded text-sm font-medium text-graphite hover:text-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-graphite text-xs font-semibold text-paper">
          {initial}
        </span>
        {name}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
          className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            role="menu"
            className="absolute right-0 top-full z-30 mt-2 w-56 origin-top-right rounded-lg border border-line bg-paper py-1.5 shadow-lg"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-graphite hover:bg-rail"
              >
                {link.label}
              </Link>
            ))}
            <div className="my-1.5 border-t border-line" />
            <form action={signOutAction}>
              <button
                type="submit"
                role="menuitem"
                className="block w-full px-4 py-2 text-left text-sm font-medium text-signal hover:bg-rail"
              >
                Sign out
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
