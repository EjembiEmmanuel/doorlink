import type { Metadata } from 'next'
import { NewTicketForm } from './NewTicketForm'

export const metadata: Metadata = {
  title: 'New support ticket',
}

export default function NewSupportTicketPage() {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-graphite">New ticket</h2>
      <NewTicketForm />
    </div>
  )
}
