import {
  CompatibilityConfidence,
  CompatibilityKind,
  DataSource,
  DocumentKind,
  ListingCondition,
  ListingStatus,
  OrgMemberRole,
  OrgType,
  PrismaClient,
  Role,
} from '@prisma/client'
import { seedInspectionTemplates } from '../src/lib/inspections/seed-templates'

const prisma = new PrismaClient()

// Three invented manufacturers only — Northgate, Veltrix, Harbrook. No real
// brand, model, manual or price appears anywhere in this file. Fabricating
// those would be worse than an empty catalogue, because a technician could
// act on it. Every row below is DataSource.DEMO.
async function main() {
  const customer = await prisma.user.upsert({
    where: { email: 'customer@demo.doorlink' },
    update: {},
    create: { email: 'customer@demo.doorlink', name: 'Demo Customer', role: Role.CUSTOMER },
  })

  const technicianUser = await prisma.user.upsert({
    where: { email: 'technician@demo.doorlink' },
    update: {},
    create: { email: 'technician@demo.doorlink', name: 'Demo Technician', role: Role.TECHNICIAN },
  })
  // The demo profile is seed-owned, so re-running the seed refreshes it
  // rather than leaving a half-populated row from an older schema behind.
  const demoTechnicianProfile = {
    verified: false,
    businessName: 'Demo Door Services',
    businessPhone: '0455 010 220',
    headline: 'Roller doors, sectional doors and automatic gates',
    serviceArea: 'Brisbane metro',
    baseSuburb: 'Brisbane',
    baseState: 'QLD',
    yearsExperience: 9,
  }
  await prisma.technicianProfile.upsert({
    where: { userId: technicianUser.id },
    update: demoTechnicianProfile,
    create: { userId: technicianUser.id, ...demoTechnicianProfile },
  })

  const supplierUser = await prisma.user.upsert({
    where: { email: 'supplier@demo.doorlink' },
    update: {},
    create: { email: 'supplier@demo.doorlink', name: 'Demo Supplier', role: Role.SUPPLIER },
  })
  const supplierOrg = await prisma.organization.upsert({
    where: { id: 'demo-supplier-org' },
    update: {},
    create: { id: 'demo-supplier-org', name: 'Demo Door Supplies', type: OrgType.SUPPLIER },
  })
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: supplierOrg.id, userId: supplierUser.id } },
    update: {},
    create: { organizationId: supplierOrg.id, userId: supplierUser.id, role: OrgMemberRole.OWNER },
  })
  await prisma.supplierProfile.upsert({
    where: { organizationId: supplierOrg.id },
    update: {},
    create: { organizationId: supplierOrg.id, commissionBps: 0, verified: false },
  })

  const manufacturerUser = await prisma.user.upsert({
    where: { email: 'manufacturer@demo.doorlink' },
    update: {},
    create: { email: 'manufacturer@demo.doorlink', name: 'Demo Manufacturer', role: Role.MANUFACTURER },
  })

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@demo.doorlink' },
    update: {},
    create: { email: 'admin@demo.doorlink', name: 'Demo Admin', role: Role.ADMIN },
  })

  const [openers, shutterMotors, smartLocks, remotes] = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'garage-door-openers' },
      update: {},
      create: { name: 'Garage Door Openers', slug: 'garage-door-openers' },
    }),
    prisma.category.upsert({
      where: { slug: 'roller-shutter-motors' },
      update: {},
      create: { name: 'Roller Shutter Motors', slug: 'roller-shutter-motors' },
    }),
    prisma.category.upsert({
      where: { slug: 'smart-locks' },
      update: {},
      create: { name: 'Smart Locks', slug: 'smart-locks' },
    }),
    prisma.category.upsert({
      where: { slug: 'remotes-accessories' },
      update: {},
      create: { name: 'Remotes & Accessories', slug: 'remotes-accessories' },
    }),
  ])

  const northgateOrg = await prisma.organization.upsert({
    where: { id: 'demo-northgate-org' },
    update: {},
    create: { id: 'demo-northgate-org', name: 'Northgate', type: OrgType.MANUFACTURER },
  })
  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: northgateOrg.id, userId: manufacturerUser.id } },
    update: {},
    create: { organizationId: northgateOrg.id, userId: manufacturerUser.id, role: OrgMemberRole.OWNER },
  })

  const northgate = await prisma.manufacturer.upsert({
    where: { slug: 'northgate' },
    update: {},
    create: { name: 'Northgate', slug: 'northgate', organizationId: northgateOrg.id, dataSource: DataSource.DEMO },
  })
  const veltrix = await prisma.manufacturer.upsert({
    where: { slug: 'veltrix' },
    update: {},
    create: { name: 'Veltrix', slug: 'veltrix', dataSource: DataSource.DEMO },
  })
  const harbrook = await prisma.manufacturer.upsert({
    where: { slug: 'harbrook' },
    update: {},
    create: { name: 'Harbrook', slug: 'harbrook', dataSource: DataSource.DEMO },
  })

  const northgateDrive = await prisma.productLine.upsert({
    where: { manufacturerId_slug: { manufacturerId: northgate.id, slug: 'drive-series' } },
    update: {},
    create: { manufacturerId: northgate.id, name: 'Drive Series', slug: 'drive-series', dataSource: DataSource.DEMO },
  })
  const veltrixRoll = await prisma.productLine.upsert({
    where: { manufacturerId_slug: { manufacturerId: veltrix.id, slug: 'roll-series' } },
    update: {},
    create: { manufacturerId: veltrix.id, name: 'Roll Series', slug: 'roll-series', dataSource: DataSource.DEMO },
  })
  const harbrookSecure = await prisma.productLine.upsert({
    where: { manufacturerId_slug: { manufacturerId: harbrook.id, slug: 'secure-series' } },
    update: {},
    create: {
      manufacturerId: harbrook.id,
      name: 'Secure Series',
      slug: 'secure-series',
      dataSource: DataSource.DEMO,
    },
  })

  const northgateOpener = await prisma.model.upsert({
    where: { slug: 'northgate-dr-700' },
    update: {},
    create: {
      manufacturerId: northgate.id,
      categoryId: openers.id,
      productLineId: northgateDrive.id,
      name: 'DR-700 Chain Drive Opener',
      modelCode: 'DR-700',
      slug: 'northgate-dr-700',
      summary: 'Chain drive sectional door opener for single garage doors. Invented for demo purposes.',
      dataSource: DataSource.DEMO,
    },
  })

  const northgateOpenerPro = await prisma.model.upsert({
    where: { slug: 'northgate-dr-900-belt' },
    update: {},
    create: {
      manufacturerId: northgate.id,
      categoryId: openers.id,
      productLineId: northgateDrive.id,
      name: 'DR-900 Belt Drive Opener',
      modelCode: 'DR-900',
      slug: 'northgate-dr-900-belt',
      summary: 'Quiet belt drive opener for double garage doors. Invented for demo purposes.',
      dataSource: DataSource.DEMO,
    },
  })

  const veltrixMotor = await prisma.model.upsert({
    where: { slug: 'veltrix-rs-40' },
    update: {},
    create: {
      manufacturerId: veltrix.id,
      categoryId: shutterMotors.id,
      productLineId: veltrixRoll.id,
      name: 'RS-40 Tubular Motor',
      modelCode: 'RS-40',
      slug: 'veltrix-rs-40',
      summary: 'Tubular motor for roller shutters up to 40kg. Invented for demo purposes.',
      dataSource: DataSource.DEMO,
    },
  })

  const harbrookLock = await prisma.model.upsert({
    where: { slug: 'harbrook-sl-200' },
    update: {},
    create: {
      manufacturerId: harbrook.id,
      categoryId: smartLocks.id,
      productLineId: harbrookSecure.id,
      name: 'SL-200 Smart Deadbolt',
      modelCode: 'SL-200',
      slug: 'harbrook-sl-200',
      summary: 'Keypad and app-controlled deadbolt. Invented for demo purposes.',
      dataSource: DataSource.DEMO,
    },
  })

  const northgateRemote = await prisma.model.upsert({
    where: { slug: 'northgate-rc-2' },
    update: {},
    create: {
      manufacturerId: northgate.id,
      categoryId: remotes.id,
      name: 'RC-2 Two-Button Remote',
      modelCode: 'RC-2',
      slug: 'northgate-rc-2',
      summary: 'Two-button remote paired with Drive Series openers. Invented for demo purposes.',
      dataSource: DataSource.DEMO,
    },
  })

  await prisma.modelSpec.createMany({
    data: [
      { modelId: northgateOpener.id, label: 'Drive type', value: 'Chain', sortOrder: 1 },
      { modelId: northgateOpener.id, label: 'Max door weight', value: '60', unit: 'kg', sortOrder: 2 },
      { modelId: northgateOpener.id, label: 'Motor force', value: '600', unit: 'N', sortOrder: 3 },
      { modelId: northgateOpenerPro.id, label: 'Drive type', value: 'Belt', sortOrder: 1 },
      { modelId: northgateOpenerPro.id, label: 'Max door weight', value: '100', unit: 'kg', sortOrder: 2 },
      { modelId: veltrixMotor.id, label: 'Max shutter weight', value: '40', unit: 'kg', sortOrder: 1 },
      { modelId: veltrixMotor.id, label: 'Tube diameter', value: '45', unit: 'mm', sortOrder: 2 },
      { modelId: harbrookLock.id, label: 'Unlock methods', value: 'Keypad, app, key', sortOrder: 1 },
      { modelId: harbrookLock.id, label: 'Battery life', value: '12', unit: 'months', sortOrder: 2 },
    ],
    skipDuplicates: true,
  })

  await prisma.document.createMany({
    data: [
      {
        modelId: northgateOpener.id,
        kind: DocumentKind.INSTALL_MANUAL,
        slug: 'dr-700-installation-guide',
        title: 'DR-700 installation guide',
        fileKey: 'demo/dr-700-install.pdf',
        dataSource: DataSource.DEMO,
      },
      {
        modelId: northgateOpener.id,
        kind: DocumentKind.WIRING_DIAGRAM,
        slug: 'dr-700-wiring-diagram',
        title: 'DR-700 wiring diagram',
        fileKey: 'demo/dr-700-wiring.pdf',
        dataSource: DataSource.DEMO,
      },
      {
        modelId: northgateOpenerPro.id,
        kind: DocumentKind.INSTALL_MANUAL,
        slug: 'dr-900-installation-guide',
        title: 'DR-900 installation guide',
        fileKey: 'demo/dr-900-install.pdf',
        dataSource: DataSource.DEMO,
      },
      {
        modelId: veltrixMotor.id,
        kind: DocumentKind.INSTALL_MANUAL,
        slug: 'rs-40-installation-guide',
        title: 'RS-40 installation guide',
        fileKey: 'demo/rs-40-install.pdf',
        dataSource: DataSource.DEMO,
      },
      {
        modelId: harbrookLock.id,
        kind: DocumentKind.USER_MANUAL,
        slug: 'sl-200-user-manual',
        title: 'SL-200 user manual',
        fileKey: 'demo/sl-200-manual.pdf',
        dataSource: DataSource.DEMO,
      },
    ],
    skipDuplicates: true,
  })

  await prisma.compatibility.upsert({
    where: {
      fromModelId_toModelId_kind: {
        fromModelId: northgateRemote.id,
        toModelId: northgateOpener.id,
        kind: CompatibilityKind.REMOTE_PAIR,
      },
    },
    update: {},
    create: {
      fromModelId: northgateRemote.id,
      toModelId: northgateOpener.id,
      kind: CompatibilityKind.REMOTE_PAIR,
      confidence: CompatibilityConfidence.CONFIRMED,
      dataSource: DataSource.DEMO,
      note: 'Same manufacturer — invented pairing for demo purposes.',
    },
  })
  await prisma.compatibility.upsert({
    where: {
      fromModelId_toModelId_kind: {
        fromModelId: northgateRemote.id,
        toModelId: northgateOpenerPro.id,
        kind: CompatibilityKind.REMOTE_PAIR,
      },
    },
    update: {},
    create: {
      fromModelId: northgateRemote.id,
      toModelId: northgateOpenerPro.id,
      kind: CompatibilityKind.REMOTE_PAIR,
      confidence: CompatibilityConfidence.LIKELY,
      dataSource: DataSource.DEMO,
      note: 'Invented pairing for demo purposes.',
    },
  })

  await prisma.listing.upsert({
    where: { id: 'demo-listing-rc-2' },
    update: {},
    create: {
      id: 'demo-listing-rc-2',
      organizationId: supplierOrg.id,
      modelId: northgateRemote.id,
      title: 'Northgate RC-2 remote (demo listing)',
      priceCents: 4500,
      currency: 'AUD',
      condition: ListingCondition.NEW,
      status: ListingStatus.ACTIVE,
      stockQty: 25,
      dataSource: DataSource.DEMO,
    },
  })

  // The Doorlink-supplied inspection templates. Unlike everything above
  // these are not demo data — they are the questions the engine asks,
  // and the feature does not work without them. Idempotent, so running
  // the seed again neither duplicates nor overwrites them.
  const templates = await seedInspectionTemplates(prisma)

  console.log(
    `Seed complete for ${customer.email}, ${technicianUser.email}, ${supplierUser.email}, ` +
      `${manufacturerUser.email}, ${adminUser.email}: 3 manufacturers, 4 categories, 5 models — all DataSource.DEMO. ` +
      `${templates} inspection template(s) installed.`
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
