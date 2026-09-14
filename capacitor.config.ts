import type { CapacitorConfig } from '@capacitor/cli'

// DoorLink is a server-rendered Next.js app (database-backed pages, Server
// Actions) — it can't be exported as static files the way most Capacitor
// apps are. Instead, the native shell just points its WebView at the real
// deployed site, the same way "wrapped web app" mobile clients normally
// work; every request still hits the real Next.js server, nothing is
// bundled or faked as offline-capable.
//
// The placeholder URL below only works once the app has a real public
// deployment (see DEVELOPMENT.md's "Native app (iOS/Android)" section for
// the full runbook) — pointing a native build at localhost is not
// meaningful outside this sandbox.
const config: CapacitorConfig = {
  appId: 'com.doorlink.app',
  appName: 'DoorLink',
  webDir: 'public',
  server: {
    url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://your-deployed-doorlink-url.example',
    cleartext: false,
  },
}

export default config
