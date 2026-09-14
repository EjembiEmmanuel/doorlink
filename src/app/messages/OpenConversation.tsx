import { openConversationAction } from './actions'

/**
 * A server-action form rather than a link: opening a thread creates a
 * row, and creating a row on GET is how a crawler ends up making
 * conversations.
 */
export function OpenConversationButton({
  jobId,
  leadId,
  label,
}: {
  jobId?: string
  leadId?: string
  label: string
}) {
  return (
    <form action={openConversationAction}>
      {jobId && <input type="hidden" name="jobId" value={jobId} />}
      {leadId && <input type="hidden" name="leadId" value={leadId} />}
      <button
        type="submit"
        className="inline-flex h-11 items-center justify-center rounded border border-line bg-paper px-4 text-sm font-medium text-graphite transition-colors hover:bg-rail active:scale-[0.97]"
      >
        {label}
      </button>
    </form>
  )
}
