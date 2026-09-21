import type { SpringResult } from './engine'
import { isUsableResult, round } from './engine'
import {
  lengthFromInch,
  lengthUnit,
  weightFromLb,
  weightUnit,
  type UnitSystem,
} from './units'

// The text that leaves the calculator — copied to a clipboard, shared,
// or pasted into a job note.
//
// Built here rather than in the component so it can be tested, and so
// the copied text and the shared text can never drift apart. Every
// summary ends with the same status line: this is an estimate. A number
// pasted into a quote without that line is the failure mode worth
// designing against.

export interface SummaryContext {
  system: UnitSystem
  springType: 'torsion' | 'extension'
  /** Free text the user gave the door, if any. */
  doorLabel?: string | null
  advanced?: boolean
}

const STATUS_LINE = 'Status: Estimate — verify before replacement'

function line(label: string, value: string): string {
  return `${label}: ${value}`
}

function num(value: number | null | undefined, places = 2): string | null {
  if (value == null) return null
  const rounded = round(value, places)
  return rounded === null ? null : String(rounded)
}

/**
 * A plain-text summary of a result.
 *
 * Returns null when the result is not usable, so a caller cannot copy
 * "NaN in-lb/turn" to somebody's clipboard.
 */
export function buildSummary(result: SpringResult, context: SummaryContext): string | null {
  if (!isUsableResult(result)) return null

  const w = weightUnit(context.system)
  const l = lengthUnit(context.system)
  const lines: string[] = ['DOORLINK', 'Garage Door Spring Calculation', '']

  if (context.doorLabel) {
    lines.push(line('Door', context.doorLabel), '')
  }

  lines.push(line('Spring type', context.springType === 'torsion' ? 'Torsion' : 'Extension'))

  if (result.kind === 'torsion-weight') {
    const weight = num(weightFromLb(result.doorWeightLb, context.system), 1)
    lines.push(
      line('Door weight', `${weight} ${w}`),
      line('Estimated IPPT', `${num(result.ipptPerSpring, 1)} in-lb/turn per spring`),
      line('Estimated turns', `${num(result.turns, 2)}`),
      line('Springs', String(result.springCount))
    )
    if (context.advanced) {
      const drum = num(lengthFromInch(result.drumRadiusIn * 2, context.system), 1)
      lines.push(
        line('Drum diameter', `${drum} ${l}`),
        line('Total moment', `${num(result.totalMomentInLb, 1)} in-lb`)
      )
    }
  }

  if (result.kind === 'torsion-measurement') {
    lines.push(
      line('Measured spring rate', `${num(result.ipptPerSpring, 1)} in-lb/turn per spring`),
      line('Springs', String(result.springCount))
    )
    if (result.requiredIpptPerSpring != null) {
      lines.push(line('Required rate', `${num(result.requiredIpptPerSpring, 1)} in-lb/turn`))
    }
    if (context.advanced) {
      const mean = num(lengthFromInch(result.meanDiameterIn, context.system), 2)
      lines.push(
        line('Mean coil diameter', `${mean} ${l}`),
        line('Active coils', `${num(result.activeCoils, 0)}`)
      )
    }
  }

  if (result.kind === 'extension') {
    const weight = num(weightFromLb(result.doorWeightLb, context.system), 1)
    const pull = num(weightFromLb(result.pullPerSpringLb, context.system), 1)
    lines.push(
      line('Door weight', `${weight} ${w}`),
      line('Estimated pull per spring', `${pull} ${w}`),
      line('Springs', String(result.springCount))
    )
    if (result.estimatedLifeYears != null) {
      lines.push(line('Estimated service life', `${num(result.estimatedLifeYears, 1)} years`))
    }
  }

  if (result.warnings.length > 0) {
    lines.push('', 'Check:')
    for (const warning of result.warnings) {
      lines.push(`- ${warning.message}`)
    }
  }

  lines.push('', STATUS_LINE)
  return lines.join('\n')
}

export { STATUS_LINE }
