import { isDemoMode } from '@/lib/integrations'

export function DemoBanner() {
  if (!isDemoMode) return null

  return (
    <div className="bg-caution-tint px-4 py-2 text-center text-sm text-caution">
      Demo mode — the catalogue below is invented sample data, not real manufacturer information.
    </div>
  )
}
