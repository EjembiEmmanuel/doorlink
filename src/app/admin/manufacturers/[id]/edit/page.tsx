import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { NotConnected } from '@/components/ui/NotConnected'
import { ManufacturerForm } from '../../ManufacturerForm'

type PageProps = { params: Promise<{ id: string }> }

export default async function EditManufacturerPage({ params }: PageProps) {
  const { id } = await params

  let manufacturer
  try {
    manufacturer = await prisma.manufacturer.findUnique({ where: { id } })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="The catalogue database" reason="Can't load this manufacturer right now." />
  }

  if (!manufacturer) notFound()

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-graphite">Edit {manufacturer.name}</h2>
      <ManufacturerForm manufacturer={manufacturer} />
    </div>
  )
}
