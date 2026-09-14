/**
 * The door configurator's option vocabulary.
 *
 * An important boundary: these are **Doorlink's generic options**, not any
 * manufacturer's range. Nobody's real colour names, finish codes or panel
 * profiles are reproduced here, because inventing a manufacturer's
 * specification — or half-remembering one — would put a claim in front of
 * a customer that the manufacturer never made. Every surface that renders
 * this says so.
 *
 * It is data, not code: adding a style, a colour or a whole new product
 * type is an entry in this file (and later, a row in the database), not a
 * rewrite of the configurator. `ProductType` is what makes gates and
 * shutters additive rather than a second implementation.
 */

export type ProductType = 'sectional' | 'roller' | 'tilt'

export interface OptionValue {
  id: string
  label: string
  /** Rendered as a swatch when present; also what the 3D preview uses. */
  hex?: string
  description?: string
  /** Which product types this value applies to. Absent means all of them. */
  only?: ProductType[]
}

export interface OptionGroup {
  id: string
  label: string
  help?: string
  values: OptionValue[]
  /** Absent means the group applies to every product type. */
  only?: ProductType[]
}

export const PRODUCT_TYPES: OptionValue[] = [
  {
    id: 'sectional',
    label: 'Sectional',
    description: 'Hinged panels that lift and run back along the ceiling. The most common on new homes.',
  },
  {
    id: 'roller',
    label: 'Roller',
    description: 'A single curtain that rolls into a drum above the opening. Good where headroom is tight.',
  },
  {
    id: 'tilt',
    label: 'Tilt',
    description: 'One rigid panel that tilts up and out. Common on older houses and single garages.',
  },
]

export const OPTION_GROUPS: OptionGroup[] = [
  {
    id: 'colour',
    label: 'Colour',
    help: 'Indicative colours, not a manufacturer’s range.',
    values: [
      { id: 'charcoal', label: 'Charcoal', hex: '#2C3033' },
      { id: 'slate', label: 'Slate grey', hex: '#585E63' },
      { id: 'pewter', label: 'Pewter', hex: '#8A9098' },
      { id: 'chalk', label: 'Chalk white', hex: '#E8E6E1' },
      { id: 'sand', label: 'Sand', hex: '#C8BBA4' },
      { id: 'ironbark', label: 'Ironbark', hex: '#3E3A34' },
      { id: 'forest', label: 'Deep forest', hex: '#2E4034' },
      { id: 'oxide', label: 'Oxide red', hex: '#6E3A32' },
    ],
  },
  {
    id: 'finish',
    label: 'Finish',
    values: [
      { id: 'matte', label: 'Matte', description: 'Low sheen. Hides marks and dust best.' },
      { id: 'satin', label: 'Satin', description: 'A soft sheen — the usual choice.' },
      { id: 'gloss', label: 'Gloss', description: 'High sheen. Shows the panel profile most.' },
      { id: 'woodgrain', label: 'Woodgrain', description: 'Textured, timber-look surface.' },
    ],
  },
  {
    id: 'panelProfile',
    label: 'Panel profile',
    only: ['sectional', 'tilt'],
    values: [
      { id: 'flush', label: 'Flush', description: 'Flat face, no stamping. The cleanest look.' },
      { id: 'raised', label: 'Raised panel', description: 'Classic stamped rectangles.' },
      { id: 'ribbed', label: 'Ribbed', description: 'Repeating horizontal lines.' },
    ],
  },
  {
    id: 'panelCount',
    label: 'Sections',
    only: ['sectional'],
    values: [
      { id: '3', label: '3 sections' },
      { id: '4', label: '4 sections' },
      { id: '5', label: '5 sections' },
    ],
  },
  {
    id: 'windows',
    label: 'Windows',
    only: ['sectional', 'tilt'],
    values: [
      { id: 'none', label: 'None' },
      { id: 'top-row', label: 'Top row', description: 'Glazing across the top section.' },
      { id: 'top-row-wide', label: 'Wide top row', description: 'Full-width glazing across the top.' },
    ],
  },
  {
    id: 'hardware',
    label: 'Hardware',
    values: [
      { id: 'brushed', label: 'Brushed steel', hex: '#B7BBC0' },
      { id: 'black', label: 'Matte black', hex: '#2A2C2E' },
      { id: 'chrome', label: 'Chrome', hex: '#D8DCE0' },
    ],
  },
  {
    id: 'insulation',
    label: 'Insulation',
    values: [
      { id: 'none', label: 'None' },
      { id: 'backed', label: 'Backed', description: 'A bonded backing layer. Quieter, a little warmer.' },
      {
        id: 'insulated',
        label: 'Fully insulated',
        description: 'Foam-filled sections. Best for a garage you use as a room.',
      },
    ],
  },
  {
    id: 'opener',
    label: 'Opener',
    values: [
      { id: 'none', label: 'Keep my existing opener' },
      {
        id: 'belt',
        label: 'Belt drive',
        description: 'Quietest. Usual choice where a bedroom adjoins the garage.',
      },
      { id: 'chain', label: 'Chain drive', description: 'Cheaper and hard-wearing, but louder.' },
      { id: 'direct', label: 'Direct drive', description: 'Motor travels on the rail. Few moving parts.' },
    ],
  },
]

export type DoorSpec = {
  productType: ProductType
  colour: string
  finish: string
  panelProfile: string
  panelCount: string
  windows: string
  hardware: string
  insulation: string
  opener: string
  widthMm: number
  heightMm: number
}

export const DEFAULT_SPEC: DoorSpec = {
  productType: 'sectional',
  colour: 'charcoal',
  finish: 'satin',
  panelProfile: 'raised',
  panelCount: '4',
  windows: 'top-row',
  hardware: 'brushed',
  insulation: 'backed',
  opener: 'belt',
  // A single-car opening, which is the most common thing to be
  // replacing. Millimetres because that is what the trade quotes in.
  widthMm: 2400,
  heightMm: 2100,
}

export const SIZE_LIMITS = {
  widthMm: { min: 1800, max: 6000, step: 10 },
  heightMm: { min: 1800, max: 3000, step: 10 },
} as const

export function groupsFor(productType: ProductType): OptionGroup[] {
  return OPTION_GROUPS.filter((group) => !group.only || group.only.includes(productType)).map((group) => ({
    ...group,
    values: group.values.filter((value) => !value.only || value.only.includes(productType)),
  }))
}

export function optionLabel(groupId: string, valueId: string): string {
  const group = OPTION_GROUPS.find((candidate) => candidate.id === groupId)
  return group?.values.find((value) => value.id === valueId)?.label ?? valueId
}

export function colourHex(colourId: string): string {
  return OPTION_GROUPS.find((g) => g.id === 'colour')?.values.find((v) => v.id === colourId)?.hex ?? '#2C3033'
}

export function hardwareHex(hardwareId: string): string {
  return (
    OPTION_GROUPS.find((g) => g.id === 'hardware')?.values.find((v) => v.id === hardwareId)?.hex ?? '#B7BBC0'
  )
}

/**
 * Reads a stored spec back, replacing anything unrecognised with the
 * default rather than trusting it. Stored specs are JSON and outlive the
 * option list that produced them: a colour retired next year must not
 * break a configuration somebody saved this year.
 */
export function parseSpec(raw: unknown): DoorSpec {
  const input = (raw ?? {}) as Partial<Record<keyof DoorSpec, unknown>>

  const productType = PRODUCT_TYPES.some((type) => type.id === input.productType)
    ? (input.productType as ProductType)
    : DEFAULT_SPEC.productType

  const pick = (groupId: string, fallback: string): string => {
    const group = OPTION_GROUPS.find((candidate) => candidate.id === groupId)
    const value = input[groupId as keyof DoorSpec]
    return typeof value === 'string' && group?.values.some((option) => option.id === value) ? value : fallback
  }

  const clamp = (value: unknown, limits: { min: number; max: number }, fallback: number) => {
    const numeric = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(numeric)) return fallback
    return Math.min(limits.max, Math.max(limits.min, Math.round(numeric)))
  }

  return {
    productType,
    colour: pick('colour', DEFAULT_SPEC.colour),
    finish: pick('finish', DEFAULT_SPEC.finish),
    panelProfile: pick('panelProfile', DEFAULT_SPEC.panelProfile),
    panelCount: pick('panelCount', DEFAULT_SPEC.panelCount),
    windows: pick('windows', DEFAULT_SPEC.windows),
    hardware: pick('hardware', DEFAULT_SPEC.hardware),
    insulation: pick('insulation', DEFAULT_SPEC.insulation),
    opener: pick('opener', DEFAULT_SPEC.opener),
    widthMm: clamp(input.widthMm, SIZE_LIMITS.widthMm, DEFAULT_SPEC.widthMm),
    heightMm: clamp(input.heightMm, SIZE_LIMITS.heightMm, DEFAULT_SPEC.heightMm),
  }
}

/** A spec written out the way a person would read it to a technician. */
export function describeSpec(spec: DoorSpec): Array<{ label: string; value: string }> {
  const type = PRODUCT_TYPES.find((candidate) => candidate.id === spec.productType)
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Door type', value: type?.label ?? spec.productType },
    { label: 'Opening', value: `${spec.widthMm} × ${spec.heightMm} mm` },
    { label: 'Colour', value: optionLabel('colour', spec.colour) },
    { label: 'Finish', value: optionLabel('finish', spec.finish) },
  ]

  if (spec.productType !== 'roller') {
    rows.push({ label: 'Panel profile', value: optionLabel('panelProfile', spec.panelProfile) })
    rows.push({ label: 'Windows', value: optionLabel('windows', spec.windows) })
  }
  if (spec.productType === 'sectional') {
    rows.push({ label: 'Sections', value: optionLabel('panelCount', spec.panelCount) })
  }

  rows.push({ label: 'Hardware', value: optionLabel('hardware', spec.hardware) })
  rows.push({ label: 'Insulation', value: optionLabel('insulation', spec.insulation) })
  rows.push({ label: 'Opener', value: optionLabel('opener', spec.opener) })
  return rows
}

/** The same thing as a paragraph, for prefilling a job request. */
export function specAsBrief(spec: DoorSpec): string {
  return describeSpec(spec)
    .map((row) => `${row.label}: ${row.value}`)
    .join('\n')
}
