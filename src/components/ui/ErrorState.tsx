export function ErrorState({
  title = 'Something went wrong',
  description,
}: {
  title?: string
  description?: string
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-md border border-bad/30 bg-bad/5 px-6 py-12 text-center"
    >
      <p className="font-medium text-bad">{title}</p>
      {description && <p className="max-w-prose text-sm text-graphite-soft">{description}</p>}
    </div>
  )
}
