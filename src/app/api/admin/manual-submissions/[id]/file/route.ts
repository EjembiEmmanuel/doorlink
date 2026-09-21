import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { createSignedFileUrl } from '@/lib/storage'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await getSession()
  if (!session || !can(session.role, 'admin:settings')) {
    return new NextResponse('Not found', { status: 404 })
  }

  const { id } = await params
  const submission = await prisma.manualSubmission.findUnique({
    where: { id },
    select: { fileKey: true },
  })
  if (!submission?.fileKey || !submission.fileKey.startsWith('manual-submissions/')) {
    return new NextResponse('File not found', { status: 404 })
  }

  const url = await createSignedFileUrl(submission.fileKey)
  if (!url) return new NextResponse('Document storage is not connected', { status: 404 })
  return NextResponse.redirect(url)
}