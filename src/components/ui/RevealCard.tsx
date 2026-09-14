'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * A small scroll-reveal + hover-lift wrapper — fades content in the first
 * time it enters the viewport (once, not on every scroll past). Used for
 * card-shaped content on the homepage rather than everything on the page,
 * so it reads as a deliberate touch rather than the whole page wobbling.
 *
 * Two things it deliberately does not do:
 *
 *  - It does not animate for anyone who has asked their system for
 *    reduced motion. They get the content, immediately.
 *  - It is marked `data-reveal`, and the root layout carries a <noscript>
 *    rule that forces those elements visible. Without that, the
 *    server-rendered HTML ships at opacity 0 and a reader without
 *    JavaScript gets blank sections where the content should be —
 *    an animation is not worth hiding the page behind.
 */
export function RevealCard({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      data-reveal
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
