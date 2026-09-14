import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import { SkipLink } from '@/components/layout/SkipLink'
import { DemoBanner } from '@/components/layout/DemoBanner'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { MobileTabBar } from '@/components/layout/MobileTabBar'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { ServiceWorkerRegister } from '@/components/layout/ServiceWorkerRegister'
import { toJsonLd } from '@/lib/json-ld'
import './globals.css'

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
})

// Restricted to identifiers — model codes, part numbers, order references —
// because that's the data a technician reads off a plate.
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'DoorLink — everything for your door, in one place',
    template: '%s · DoorLink',
  },
  description:
    'Product identification, technical documentation, compatible parts, suppliers and technicians for the garage door, roller shutter, motor and locking industry.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'DoorLink',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#1B1D1F',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'DoorLink',
  url: siteUrl,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="flex min-h-screen flex-col bg-paper font-sans text-graphite antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(websiteJsonLd) }} />
        <SkipLink />
        <DemoBanner />
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <MobileTabBar />
        <InstallPrompt />
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
