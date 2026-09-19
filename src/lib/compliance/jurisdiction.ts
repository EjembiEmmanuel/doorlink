import type { AuState } from '../australia'

/**
 * Jurisdiction handling — the most important honesty boundary in this
 * feature.
 *
 * The source pack lists New South Wales instruments and carries a
 * "CHECK YOUR JURISDICTION" notice telling the reader to substitute the
 * equivalents for their own state. Doorlink generates documents branded
 * with a business's name, so this cannot be left implicit: a Victorian
 * business must not be handed a document that silently cites the NSW
 * Work Health and Safety Act as the law it operates under.
 *
 * So there are exactly two behaviours, and no third:
 *
 * - **New South Wales.** The list from the source pack, as written.
 * - **Anywhere else.** The Commonwealth instruments, which do not vary
 *   by state, plus an explicit gap that names what has to be supplied.
 *
 * What there is *not* is a guessed list of state instruments for the
 * other seven jurisdictions. Legislation names, years and regulator
 * titles differ in ways that cannot be derived, and inventing them would
 * put a citation in a compliance document that nobody checked. The brief
 * is explicit: do not invent missing information.
 */

/** Applies everywhere in Australia. Transcribed from the source pack. */
export const COMMONWEALTH_LEGISLATION: string[] = [
  'Fair Work Act 2009 (Cth)',
  'Independent Contractors Act 2006 (Cth)',
  'Privacy Act 1988 (Cth)',
]

/** New South Wales, as printed in the source pack. */
export const NSW_LEGISLATION: string[] = [
  'Work Health and Safety Act 2011 (NSW)',
  'Work Health and Safety Regulation 2017 (NSW)',
  'Workers Compensation Act 1987 (NSW)',
  'Workers Compensation Regulation 2023 (NSW)',
  'Anti-Discrimination Act 1977 (NSW)',
]

/** Closes every list in the source pack, and is not state-specific. */
export const GENERAL_LEGISLATION: string[] = [
  'Electrical safety legislation and the Australian Standards applicable to the works being undertaken',
]

export interface LegislationList {
  /** Instruments Doorlink can state, because they were supplied. */
  items: string[]
  /**
   * Set when state instruments are missing and the business has to
   * supply them. Rendered as a visible gap in the document, never
   * omitted quietly.
   */
  gap: string | null
  /** The jurisdiction this list was built for, for the document header. */
  state: string
}

export function legislationFor(state: string | null | undefined): LegislationList {
  const normalised = (state ?? '').trim().toUpperCase()

  if (normalised === 'NSW') {
    return {
      state: 'NSW',
      items: [...COMMONWEALTH_LEGISLATION, ...NSW_LEGISLATION, ...GENERAL_LEGISLATION],
      gap: null,
    }
  }

  if (!normalised) {
    return {
      state: 'Not set',
      items: [...COMMONWEALTH_LEGISLATION, ...GENERAL_LEGISLATION],
      gap: 'No state or territory has been recorded. Set one in your compliance details, then add the work health and safety, workers compensation and anti-discrimination instruments that apply there.',
    }
  }

  return {
    state: normalised,
    items: [...COMMONWEALTH_LEGISLATION, ...GENERAL_LEGISLATION],
    gap: `Doorlink holds the New South Wales instrument list only. Before issuing this document, add the ${normalised} work health and safety, workers compensation and anti-discrimination Acts and Regulations, and confirm the applicable regulator.`,
  }
}

/**
 * The WHS regulator, where a business has not named one. Only NSW is
 * stated, for the same reason as above — the others are left to the
 * business rather than guessed.
 */
export function defaultRegulator(state: string | null | undefined): string | null {
  return (state ?? '').trim().toUpperCase() === 'NSW' ? 'SafeWork NSW' : null
}

export function isFullySupported(state: string | null | undefined): state is AuState {
  return (state ?? '').trim().toUpperCase() === 'NSW'
}
