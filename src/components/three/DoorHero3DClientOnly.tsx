'use client'

import dynamic from 'next/dynamic'

// `ssr: false` requires the call site to be inside a Client Component —
// the homepage that renders this is a Server Component, so the dynamic()
// call itself lives here rather than there.
const DoorHero3D = dynamic(() => import('./DoorHero3D').then((mod) => mod.DoorHero3D), {
  ssr: false,
  loading: () => <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-rail sm:aspect-[16/10]" />,
})

export function DoorHero3DClientOnly() {
  return <DoorHero3D />
}
