import { renderAppIcon } from '@/lib/app-icon'

const ALLOWED_SIZES = [16, 32, 48, 96, 180, 192, 256, 384, 512]

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params
  const requested = Number(size)
  const safeSize = ALLOWED_SIZES.includes(requested) ? requested : 512
  return renderAppIcon({ size: safeSize })
}
