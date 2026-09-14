// Dev-only: clears marketplace activity (leads, quotes, jobs, transactions,
// reviews) so a flow can be walked from a known-empty state. Never run
// against anything but a local demo database.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.transactionEvent.deleteMany({})
  await prisma.transaction.deleteMany({})
  await prisma.workerReview.deleteMany({})
  await prisma.jobStatusEvent.deleteMany({})
  await prisma.job.deleteMany({})
  await prisma.quote.deleteMany({})
  await prisma.leadPhoto.deleteMany({})
  await prisma.lead.deleteMany({})
  await prisma.technicianProfile.updateMany({
    data: { ratingAvg: null, ratingCount: 0, jobsCompleted: 0 },
  })
  console.log('marketplace activity cleared')
}

main().finally(() => prisma.$disconnect())
