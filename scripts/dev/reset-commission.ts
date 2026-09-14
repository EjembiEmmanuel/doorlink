// Dev-only: puts the commission rate back to its default and clears the
// change history, so the admin settings flow can be walked from a known
// starting point.
import { PrismaClient } from '@prisma/client'
import { COMMISSION_SETTING_KEY, DEFAULT_COMMISSION_BPS } from '../../src/lib/commission'

const prisma = new PrismaClient()

async function main() {
  await prisma.auditLog.deleteMany({
    where: { entityType: 'PlatformSetting', entityId: COMMISSION_SETTING_KEY },
  })
  await prisma.platformSetting.upsert({
    where: { key: COMMISSION_SETTING_KEY },
    update: { value: DEFAULT_COMMISSION_BPS },
    create: { key: COMMISSION_SETTING_KEY, value: DEFAULT_COMMISSION_BPS },
  })
  console.log(`commission reset to ${DEFAULT_COMMISSION_BPS} bps, history cleared`)
}

main().finally(() => prisma.$disconnect())
