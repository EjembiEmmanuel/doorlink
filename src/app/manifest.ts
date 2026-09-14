import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DoorLink — everything for your door',
    short_name: 'DoorLink',
    description:
      'Identify your garage door, roller shutter, motor or lock, then find the manual, compatible parts and the people who can fit them.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FAFAF9',
    theme_color: '#1B1D1F',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable/192', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
