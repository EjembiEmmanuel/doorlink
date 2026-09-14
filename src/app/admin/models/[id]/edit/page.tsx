import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { NotConnected } from '@/components/ui/NotConnected'
import { ModelForm } from '../../ModelForm'

type PageProps = { params: Promise<{ id: string }> }

export default async function EditModelPage({ params }: PageProps) {
  const { id } = await params

  let model, manufacturers, categories, productLines
  try {
    ;[model, manufacturers, categories, productLines] = await Promise.all([
      prisma.model.findUnique({ where: { id } }),
      prisma.manufacturer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.productLine.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, manufacturerId: true },
      }),
    ])
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="The catalogue database" reason="Can't load this model right now." />
  }

  if (!model) notFound()

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-graphite">Edit {model.name}</h2>
      <ModelForm model={model} manufacturers={manufacturers} categories={categories} productLines={productLines} />
    </div>
  )
}
