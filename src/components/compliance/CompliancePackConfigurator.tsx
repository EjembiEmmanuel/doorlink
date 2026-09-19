'use client'

import { FormEvent, useEffect, useState } from 'react'

const PACK_PRICE = '$29.99'

export function CompliancePackConfigurator() {
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [contactName, setContactName] = useState('')
  const [abn, setAbn] = useState('')
  const [phone, setPhone] = useState('')
  const [logoName, setLogoName] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview)
    }
  }, [logoPreview])

  function handleLogoChange(file: File | undefined) {
    if (!file) return
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    setLogoName(file.name)
    setLogoPreview(URL.createObjectURL(file))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved(true)
  }

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <section className="rounded-md border border-line bg-paper p-5 sm:p-7" aria-labelledby="pack-configure-heading">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-code text-micro font-semibold uppercase tracking-[0.18em] text-zinc-deep">01 / prepare</p>
            <h2 id="pack-configure-heading" className="mt-2 text-xl font-semibold text-graphite">
              Add your business details
            </h2>
          </div>
          <span className="rounded border border-signal/40 bg-signal-tint px-3 py-1.5 text-sm font-semibold text-signal">
            {PACK_PRICE} one-off
          </span>
        </div>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium text-graphite">
              Company name
              <input
                required
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="mt-2 h-11 w-full rounded border border-line bg-rail px-3 text-sm text-graphite outline-none transition-colors placeholder:text-zinc-deep focus:border-signal focus:ring-2 focus:ring-signal/20"
                placeholder="Your business name"
              />
            </label>
            <label className="block text-sm font-medium text-graphite">
              Work email
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 h-11 w-full rounded border border-line bg-rail px-3 text-sm text-graphite outline-none transition-colors placeholder:text-zinc-deep focus:border-signal focus:ring-2 focus:ring-signal/20"
                placeholder="you@company.com"
              />
            </label>
            <label className="block text-sm font-medium text-graphite">
              Contact name
              <input
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                className="mt-2 h-11 w-full rounded border border-line bg-rail px-3 text-sm text-graphite outline-none transition-colors placeholder:text-zinc-deep focus:border-signal focus:ring-2 focus:ring-signal/20"
                placeholder="Person responsible for the pack"
              />
            </label>
            <label className="block text-sm font-medium text-graphite">
              ABN / business identifier
              <input
                value={abn}
                onChange={(event) => setAbn(event.target.value)}
                className="mt-2 h-11 w-full rounded border border-line bg-rail px-3 text-sm text-graphite outline-none transition-colors placeholder:text-zinc-deep focus:border-signal focus:ring-2 focus:ring-signal/20"
                placeholder="Optional"
              />
            </label>
          </div>

          <label className="block text-sm font-medium text-graphite">
            Contact phone
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-2 h-11 w-full rounded border border-line bg-rail px-3 text-sm text-graphite outline-none transition-colors placeholder:text-zinc-deep focus:border-signal focus:ring-2 focus:ring-signal/20"
              placeholder="Optional"
            />
          </label>

          <label className="block text-sm font-medium text-graphite">
            Company logo
            <span className="mt-2 flex min-h-24 cursor-pointer items-center justify-center rounded border border-dashed border-line bg-rail px-4 text-center text-sm text-graphite-soft transition-colors hover:border-signal">
              <span>{logoName || 'Choose a PNG, JPG or SVG logo'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="sr-only"
                onChange={(event) => handleLogoChange(event.target.files?.[0])}
              />
            </span>
          </label>

          {logoPreview && (
            <div className="flex items-center gap-3 rounded border border-line bg-rail p-3">
              <img src={logoPreview} alt="Selected company logo preview" className="h-12 w-24 object-contain" />
              <p className="text-sm text-graphite-soft">{logoName} is ready to add to your working pack.</p>
            </div>
          )}

          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded bg-signal px-5 text-sm font-semibold text-paper transition-colors hover:bg-signal-hover"
          >
            Save pack details
          </button>
          {saved && (
            <p className="text-sm text-signal" role="status">
              Your details are ready for checkout. The original 64-page pack remains unchanged until a purchase is completed.
            </p>
          )}
        </form>
      </section>

      <aside className="flex flex-col rounded-md border border-line bg-rail p-5 sm:p-7" aria-labelledby="pack-includes-heading">
        <p className="font-code text-micro font-semibold uppercase tracking-[0.18em] text-zinc-deep">02 / access</p>
        <h2 id="pack-includes-heading" className="mt-2 text-xl font-semibold text-graphite">
          A complete working pack
        </h2>
        <ul className="mt-6 space-y-3 text-sm leading-6 text-graphite-soft">
          <li><strong className="font-medium text-graphite">15 documents</strong> across 9 practical sections.</li>
          <li>Business control, compliance, WHS, risk, safe work, inspections and job records.</li>
          <li>A4 print and digital layout with blank business and client fields.</li>
          <li>Your logo and company details are intended to replace the marked blank panels.</li>
        </ul>

        <div className="mt-8 flex flex-col gap-3">
          <a
            href="/downloads/doorlink-compliance-safety-pack.pdf"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center rounded border border-line bg-paper px-4 text-sm font-semibold text-graphite transition-colors hover:border-signal"
          >
            Preview original pack
          </a>
          <button
            type="button"
            disabled
            className="inline-flex h-11 items-center justify-center rounded bg-signal px-4 text-sm font-semibold text-paper opacity-50"
          >
            Purchase &amp; prepare pack — {PACK_PRICE}
          </button>
          <p className="text-xs leading-5 text-zinc-deep">
            Checkout is not connected in this workspace yet. No payment is taken and no paid access is claimed until a
            payment provider is connected.
          </p>
        </div>

        <div className="mt-auto border-t border-line pt-6">
          <p className="text-xs leading-5 text-zinc-deep">
            Important: this is a general documentation template, not legal advice. Review it for your jurisdiction,
            equipment, workers, insurance and actual operating procedures before sending it to clients.
          </p>
        </div>
      </aside>
    </div>
  )
}