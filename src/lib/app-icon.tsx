import { ImageResponse } from 'next/og'

// One shared glyph — a bold "D" on graphite — used for the browser
// favicon, the iOS home-screen icon, and every size the PWA manifest
// needs, rather than a static image asset nobody's designed yet.
export function renderAppIcon({ size, maskable = false }: { size: number; maskable?: boolean }) {
  const padding = maskable ? size * 0.24 : size * 0.16
  const glyphSize = size - padding * 2

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1B1D1F',
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: glyphSize,
            height: glyphSize,
            fontSize: glyphSize * 0.74,
            fontWeight: 700,
            color: '#FAFAF9',
            fontFamily: 'sans-serif',
            borderBottom: `${Math.max(2, size * 0.02)}px solid #1B4FA8`,
            lineHeight: 1,
          }}
        >
          D
        </div>
      </div>
    ),
    { width: size, height: size }
  )
}
