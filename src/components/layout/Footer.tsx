import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-line bg-rail pb-16 sm:pb-0">
      <div className="mx-auto flex max-w-shell flex-col gap-4 px-4 py-8 text-sm text-zinc-deep sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Doorlink. Everything for your door, in one place.</p>
        <div className="flex gap-4">
          <Link href="/data-sources" className="hover:text-graphite">
            Data sources
          </Link>
          <Link href="/find" className="hover:text-graphite">
            Find your part
          </Link>
        </div>
      </div>
    </footer>
  )
}
