import { Badge } from './Badge'

export function NotConnected({ feature, reason }: { feature: string; reason?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-caution/30 bg-caution-tint px-6 py-10 text-center">
      <Badge tone="caution">Not connected</Badge>
      <p className="font-medium text-graphite">{feature} isn&apos;t connected yet.</p>
      {reason && <p className="max-w-prose text-sm text-graphite-soft">{reason}</p>}
    </div>
  )
}
