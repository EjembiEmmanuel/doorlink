'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

// A small, reusable scroll-reveal + hover-lift wrapper — fades/slides a
// card in the first time it enters the viewport (once, not every scroll
// past) and lifts it slightly on hover. Used for card-shaped content on
// the homepage rather than every element on the page, so the effect
// reads as a deliberate touch rather than everything wobbling at once.
export function RevealCard({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      whileHover={{ y: -3 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
