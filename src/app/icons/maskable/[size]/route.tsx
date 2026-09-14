import { renderAppIcon } from '@/lib/app-icon'

const ALLOWED_SIZES = [192, 512]

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params
  const requested = Number(size)
  const safeSize = ALLOWED_SIZES.includes(requested) ? requested : 512
  return renderAppIcon({ size: safeSize, maskable: true })
}
