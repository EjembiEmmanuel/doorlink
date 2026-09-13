'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { DataSource } from '@prisma/client'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { NotConnected } from '@/components/ui/NotConnected'
import { SourceBadge } from '@/components/ui/SourceBadge'

type FinderStep = 'category' | 'manufacturer' | 'productLine' | 'model' | 'confirm'

interface Option {
  id: string
  name: string
}

interface ConfirmedModel {
  id: string
  name: string
  modelCode: string
  summary: string | null
  dataSource: DataSource
  manufacturer: { name: string }
  category: { name: string }
  productLine: { name: string } | null
}

interface Selection {
  categoryId?: string
  categoryName?: string
  manufacturerId?: string
  manufacturerName?: string
  productLineId?: string
  productLineName?: string
}

const STEP_LABELS: Record<FinderStep, string> = {
  category: 'Category',
  manufacturer: 'Manufacturer',
  productLine: 'Product line',
  model: 'Model',
  confirm: 'Confirm',
}

export function FinderCascade() {
  const [selection, setSelection] = useState<Selection>({})
  const [step, setStep] = useState<FinderStep>('category')
  const [options, setOptions] = useState<Option[]>([])
  const [confirmedModel, setConfirmedModel] = useState<ConfirmedModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notConnected, setNotConnected] = useState(false)

  useEffect(() => {
    if (step === 'confirm') return

    const params = new URLSearchParams({ step })
    if (selection.categoryId) params.set('categoryId', selection.categoryId)
    if (selection.manufacturerId) params.set('manufacturerId', selection.manufacturerId)
    if (selection.productLineId) params.set('productLineId', selection.productLineId)

    let cancelled = false

    async function loadOptions() {
      setLoading(true)
      setError(null)
      setNotConnected(false)
      try {
        const response = await fetch(`/api/finder?${params.toString()}`)
        if (response.status === 503) {
          if (!cancelled) setNotConnected(true)
          return
        }
        if (!response.ok) throw new Error('Could not load options.')
        const data = (await response.json()) as { options: Option[] }
        if (!cancelled) setOptions(data.options)
      } catch {
        if (!cancelled) setError('Could not load options. Try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadOptions()

    return () => {
      cancelled = true
    }
  }, [step, selection.categoryId, selection.manufacturerId, selection.productLineId])

  function handleBreadcrumbClick(target: FinderStep) {
    // Stepping back clears everything chosen after that point so the
    // cascade can never be left pointing at options that no longer apply.
    setSelection((current) => {
      const next: Selection = {}
      if (target !== 'category') {
        next.categoryId = current.categoryId
        next.categoryName = current.categoryName
      }
      if (target === 'productLine' || target === 'model') {
        next.manufacturerId = current.manufacturerId
        next.manufacturerName = current.manufacturerName
      }
      if (target === 'model') {
        next.productLineId = current.productLineId
        next.productLineName = current.productLineName
      }
      return next
    })
    setConfirmedModel(null)
    setStep(target)
  }

  function handleSelect(option: Option) {
    if (step === 'category') {
      setSelection({ categoryId: option.id, categoryName: option.name })
      setStep('manufacturer')
      return
    }
    if (step === 'manufacturer') {
      setSelection((current) => ({ ...current, manufacturerId: option.id, manufacturerName: option.name }))
      setStep('productLine')
      return
    }
    if (step === 'productLine') {
      setSelection((current) => ({ ...current, productLineId: option.id, productLineName: option.name }))
      setStep('model')
      return
    }
    if (step === 'model') {
      loadConfirmation(option.id)
    }
  }

  async function loadConfirmation(modelId: string) {
    setLoading(true)
    setError(null)
    setNotConnected(false)
    try {
      const response = await fetch(`/api/finder?step=confirm&modelId=${modelId}`)
      if (response.status === 503) {
        setNotConnected(true)
        return
      }
      if (!response.ok) throw new Error('Could not load this model.')
      const data = (await response.json()) as { model: ConfirmedModel }
      setConfirmedModel(data.model)
      setStep('confirm')
    } catch {
      setError('Could not load this model. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const breadcrumbs: { step: FinderStep; label: string }[] = [
    { step: 'category', label: selection.categoryName ?? STEP_LABELS.category },
  ]
  if (selection.categoryId) {
    breadcrumbs.push({ step: 'manufacturer', label: selection.manufacturerName ?? STEP_LABELS.manufacturer })
  }
  if (selection.manufacturerId) {
    breadcrumbs.push({ step: 'productLine', label: selection.productLineName ?? STEP_LABELS.productLine })
  }
  if (selection.manufacturerId) {
    breadcrumbs.push({ step: 'model', label: STEP_LABELS.model })
  }

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Finder progress" className="flex flex-wrap items-center gap-1 text-sm text-zinc-deep">
        {breadcrumbs.map((crumb, index) => (
          <span key={crumb.step} className="flex items-center gap-1">
            {index > 0 && <span aria-hidden="true">/</span>}
            <button
              type="button"
              onClick={() => handleBreadcrumbClick(crumb.step)}
              disabled={crumb.step === step}
              className="rounded px-1 py-0.5 hover:text-signal disabled:cursor-default disabled:text-graphite disabled:hover:text-graphite"
            >
              {crumb.label}
            </button>
          </span>
        ))}
      </nav>

      {notConnected && (
        <NotConnected
          feature="The product catalogue"
          reason="The catalogue database isn't reachable right now, so nothing can be loaded here."
        />
      )}

      {!notConnected && step !== 'confirm' && (
        <div>
          {loading && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
            </div>
          )}

          {!loading && error && <ErrorState description={error} />}

          {!loading && !error && options.length === 0 && (
            <EmptyState
              title="Nothing matches yet"
              description="No catalogue entries exist for this combination in the current data."
            />
          )}

          {!loading && !error && options.length > 0 && (
            <ul className="flex flex-col gap-2">
              {options.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(option)}
                    className="flex h-11 w-full items-center rounded border border-line px-4 text-left text-sm hover:border-signal hover:bg-signal-tint"
                  >
                    {option.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {step === 'productLine' && !loading && !error && (
            <button
              type="button"
              onClick={() => setStep('model')}
              className="mt-3 text-sm font-medium text-signal hover:text-signal-hover"
            >
              Skip — I don&apos;t know the product line
            </button>
          )}
        </div>
      )}

      {!notConnected && step === 'confirm' && confirmedModel && (
        <div className="flex flex-col gap-3 rounded-md border border-line p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-code text-sm text-zinc-deep">{confirmedModel.modelCode}</p>
              <p className="text-lg font-semibold text-graphite">{confirmedModel.name}</p>
              <p className="text-sm text-zinc-deep">
                {confirmedModel.manufacturer.name} · {confirmedModel.category.name}
              </p>
            </div>
            <SourceBadge source={confirmedModel.dataSource} />
          </div>
          {confirmedModel.summary && <p className="text-sm text-graphite-soft">{confirmedModel.summary}</p>}
          <div className="flex items-center gap-4">
            <Link
              href={`/model/${confirmedModel.id}`}
              className="inline-flex h-11 items-center justify-center rounded bg-signal px-5 text-sm font-medium text-paper hover:bg-signal-hover"
            >
              View full product page
            </Link>
            <button
              type="button"
              onClick={() => handleBreadcrumbClick('category')}
              className="text-sm font-medium text-signal hover:text-signal-hover"
            >
              Not the right one? Start over
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-line pt-4 text-sm text-zinc-deep">
        <Link href="/find/unknown" className="font-medium text-signal hover:text-signal-hover">
          I don&apos;t know my model
        </Link>
      </div>
    </div>
  )
}
