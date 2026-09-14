// Dev-only: posts one demo job request so the quote/hire flow can be
// walked without filling the public form every time.
import { PrismaClient, UrgencyLevel } from '@prisma/client'
import { makeReference } from '../../src/lib/reference'

const prisma = new PrismaClient()

async function main() {
  const customer = await prisma.user.findUnique({ where: { email: 'customer@demo.doorlink' } })
  if (!customer) throw new Error('demo customer missing — run the main seed first')
  const category = await prisma.serviceCategory.findFirst({ where: { name: { contains: 'Garage door repair' } } })

  const lead = await prisma.lead.create({
    data: {
      reference: makeReference('LEAD'),
      customerId: customer.id,
      serviceCategoryId: category?.id ?? null,
      title: 'Garage roller door will not close from the remote',
      message:
        'B&D roller door in Brunswick. Opens fine but stops halfway when closing, then reverses. Started after a storm last week. Two cars stuck inside.',
      name: customer.name,
      email: customer.email,
      phone: '0412 345 678',
      suburb: 'Brunswick',
      state: 'VIC',
      postcode: '3056',
      urgency: UrgencyLevel.URGENT,
      preferredTiming: 'Weekday mornings before 10am',
      budgetMaxCents: 60000,
    },
  })
  console.log('created', lead.reference, lead.id)
}

main().finally(() => prisma.$disconnect())
