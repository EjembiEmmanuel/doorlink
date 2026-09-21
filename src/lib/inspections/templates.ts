import { AnswerStatus, AssetType, FindingSeverity, QuestionType } from '@prisma/client'

// The Doorlink-supplied inspection template.
//
// Two things this file deliberately does not do.
//
// It cites no regulation. Every question below is a condition a
// competent technician can observe and record — "is the emergency stop
// functional", not "does this comply with clause 4.2". Regulatory
// citations live in ComplianceReference, carry their own jurisdiction
// and last-reviewed date, and are attached by an admin who has checked
// the source. Writing them inline here would mean shipping legal claims
// nobody verified (brief §14, §36).
//
// It draws no legal conclusion from an answer. A rule can flag a failed
// emergency stop as CRITICAL, because that is an engineering judgement
// about risk. It does not say the equipment is unlawful, because that
// depends on the jurisdiction, the duty holder and the use of the
// building — none of which this template knows.

export interface SeedRule {
  whenStatus?: AnswerStatus
  whenValue?: string
  severity: FindingSeverity
  requireNote?: boolean
  requirePhoto?: boolean
  recommendation?: string
  suggestedActionTitle?: string
}

export interface SeedQuestion {
  code: string
  prompt: string
  helpText?: string
  type?: QuestionType
  required?: boolean
  options?: string[]
  unit?: string
  requirePhoto?: boolean
  recommendPhoto?: boolean
  showWhen?: { questionCode: string; equals: string[] }
  rules?: SeedRule[]
}

export interface SeedSection {
  title: string
  description?: string
  assetTypes?: AssetType[]
  questions: SeedQuestion[]
}

export interface SeedTemplate {
  slug: string
  name: string
  description: string
  assetTypes: AssetType[]
  sections: SeedSection[]
}

// A failed safety device is the archetypal high-severity finding: it is
// the thing that was fitted to stop someone being hurt, and it is not
// working. Reused across the safety sections so the grading is
// consistent rather than re-decided question by question.
const SAFETY_CRITICAL: SeedRule = {
  whenStatus: AnswerStatus.FAIL,
  severity: FindingSeverity.CRITICAL,
  requireNote: true,
  requirePhoto: true,
  recommendation: 'Withdraw from automatic operation until the safety function is restored.',
  suggestedActionTitle: 'Restore safety function',
}

const SAFETY_HIGH: SeedRule = {
  whenStatus: AnswerStatus.FAIL,
  severity: FindingSeverity.HIGH,
  requireNote: true,
  requirePhoto: true,
  suggestedActionTitle: 'Rectify safety defect',
}

const CONDITION_MEDIUM: SeedRule = {
  whenStatus: AnswerStatus.FAIL,
  severity: FindingSeverity.MEDIUM,
  requireNote: true,
  suggestedActionTitle: 'Rectify defect',
}

// "I could not test this" is not a pass. It is recorded at OBSERVATION
// so it reaches the report and the customer can see what was not
// covered, without being graded as a defect that was found.
const NOT_TESTED_NOTE: SeedRule = {
  whenStatus: AnswerStatus.NOT_TESTED,
  severity: FindingSeverity.OBSERVATION,
  requireNote: true,
  recommendation: 'Re-attend to complete the untested check.',
}

const STRUCTURAL: SeedSection = {
  title: 'Structural safety',
  description: 'The parts that hold the equipment up and keep it in its opening.',
  questions: [
    {
      code: 'STR_FIXINGS',
      prompt: 'Are the fixings to the structure secure?',
      rules: [SAFETY_HIGH, NOT_TESTED_NOTE],
    },
    {
      code: 'STR_DAMAGE',
      prompt: 'Is the structure free from visible damage or distortion?',
      rules: [CONDITION_MEDIUM],
    },
    {
      code: 'STR_GUIDES',
      prompt: 'Are the guides or tracks secure and correctly aligned?',
      rules: [SAFETY_HIGH],
    },
    {
      code: 'STR_BEARINGS',
      prompt: 'Are bearings, shafts and support components in serviceable condition?',
      rules: [CONDITION_MEDIUM],
    },
    {
      code: 'STR_CORROSION',
      prompt: 'Is the equipment free from corrosion that affects its strength?',
      helpText: 'Surface rust on a finish is a condition note; corrosion into a load-bearing section is not.',
      rules: [CONDITION_MEDIUM],
    },
  ],
}

const MECHANICAL: SeedSection = {
  title: 'Mechanical safety',
  questions: [
    {
      code: 'MECH_OPERATION',
      prompt: 'Do the moving components operate smoothly through the full travel?',
      rules: [CONDITION_MEDIUM, NOT_TESTED_NOTE],
    },
    {
      code: 'MECH_WEAR',
      prompt: 'Are the moving components free from excessive wear?',
      rules: [CONDITION_MEDIUM],
    },
    {
      code: 'MECH_NOISE',
      prompt: 'Is the equipment free from abnormal noise or movement in operation?',
      rules: [{ whenStatus: AnswerStatus.FAIL, severity: FindingSeverity.LOW, requireNote: true }],
    },
    {
      code: 'MECH_BALANCE',
      prompt: 'Is the door balanced and held in position when released mid-travel?',
      helpText: 'A door that runs away when released indicates a spring or counterbalance fault.',
      rules: [SAFETY_HIGH, NOT_TESTED_NOTE],
    },
    {
      code: 'MECH_FASTENERS',
      prompt: 'Are all mechanical fasteners present and tight?',
      rules: [CONDITION_MEDIUM],
    },
  ],
}

const ELECTRICAL: SeedSection = {
  title: 'Electrical safety',
  description: 'Visual and functional condition only. This is not an electrical test or certification.',
  questions: [
    {
      code: 'ELEC_ENCLOSURES',
      prompt: 'Are electrical components enclosed with covers intact?',
      rules: [SAFETY_HIGH],
    },
    {
      code: 'ELEC_WIRING',
      prompt: 'Is the visible wiring free from damage and correctly supported?',
      rules: [SAFETY_HIGH],
    },
    {
      code: 'ELEC_ISOLATION',
      prompt: 'Is an accessible means of isolation provided?',
      rules: [{ whenStatus: AnswerStatus.FAIL, severity: FindingSeverity.HIGH, requireNote: true }],
    },
    {
      code: 'ELEC_CONTROLS',
      prompt: 'Are the control devices secure and legible?',
      rules: [CONDITION_MEDIUM],
    },
  ],
}

const OPERATIONAL: SeedSection = {
  title: 'Operational safety',
  questions: [
    {
      code: 'OP_ESTOP_FITTED',
      prompt: 'Is an emergency stop fitted?',
      type: QuestionType.YES_NO,
      helpText: 'Answer for what is actually installed, not what should be.',
    },
    {
      code: 'OP_ESTOP_WORKS',
      prompt: 'Does the emergency stop halt movement when operated?',
      showWhen: { questionCode: 'OP_ESTOP_FITTED', equals: ['YES'] },
      requirePhoto: true,
      rules: [SAFETY_CRITICAL, NOT_TESTED_NOTE],
    },
    {
      code: 'OP_MANUAL_RELEASE',
      prompt: 'Does the manual release operate correctly?',
      helpText: 'Mark not applicable where no manual release is fitted.',
      rules: [SAFETY_HIGH, NOT_TESTED_NOTE],
    },
    {
      code: 'OP_CONTROLS',
      prompt: 'Do the control devices operate the equipment as intended?',
      rules: [CONDITION_MEDIUM],
    },
    {
      code: 'OP_TRAVEL_LIMITS',
      prompt: 'Does the equipment stop correctly at both travel limits?',
      rules: [SAFETY_HIGH, NOT_TESTED_NOTE],
    },
  ],
}

const PEDESTRIAN: SeedSection = {
  title: 'Pedestrian safety',
  description: 'How the equipment behaves around the people who pass through it.',
  questions: [
    {
      code: 'PED_SAFETY_DEVICE_FITTED',
      prompt: 'Are powered safety devices fitted (safety edge, photo beams)?',
      type: QuestionType.MULTI_SELECT,
      options: ['Safety edge', 'Photoelectric beams', 'Light curtain', 'Pressure sensing', 'None fitted'],
      rules: [
        {
          whenValue: 'None fitted',
          severity: FindingSeverity.HIGH,
          requireNote: true,
          recommendation:
            'Powered equipment with no protective device relies entirely on the operator seeing the hazard. Review against the equipment’s intended use and the manufacturer’s requirements.',
          suggestedActionTitle: 'Review protective devices',
        },
      ],
    },
    {
      code: 'PED_SAFETY_DEVICE_WORKS',
      prompt: 'Do the fitted safety devices stop or reverse the equipment when obstructed?',
      showWhen: {
        questionCode: 'PED_SAFETY_DEVICE_FITTED',
        equals: ['Safety edge', 'Photoelectric beams', 'Light curtain', 'Pressure sensing'],
      },
      requirePhoto: true,
      rules: [SAFETY_CRITICAL, NOT_TESTED_NOTE],
    },
    {
      code: 'PED_UNCONTROLLED',
      prompt: 'Is the equipment free from uncontrolled or unexpected movement?',
      rules: [SAFETY_CRITICAL],
    },
    {
      code: 'PED_CRUSH',
      prompt: 'Is the installation free from accessible crushing or trapping points?',
      rules: [SAFETY_HIGH],
    },
    {
      code: 'PED_SIGNAGE',
      prompt: 'Is warning signage present where required by the installation?',
      rules: [{ whenStatus: AnswerStatus.FAIL, severity: FindingSeverity.LOW, requireNote: true }],
    },
  ],
}

// Asset-specific configuration. These sections are the conditional
// engine doing its job: a technician inspecting a swing gate is never
// shown a question about a curtain lath.
const SHUTTER_CONFIG: SeedSection = {
  title: 'Roller shutter configuration',
  assetTypes: [AssetType.ROLLER_SHUTTER, AssetType.INDUSTRIAL_DOOR],
  questions: [
    {
      code: 'CFG_SHUTTER_DRIVE',
      prompt: 'Drive type',
      type: QuestionType.SINGLE_SELECT,
      options: ['Tubular motor', 'Side motor', 'Centre motor', 'Chain hoist', 'Manual push-up', 'Spring balanced'],
    },
    {
      code: 'CFG_SHUTTER_CURTAIN',
      prompt: 'Curtain or lath type',
      type: QuestionType.SINGLE_SELECT,
      options: ['Solid lath', 'Perforated lath', 'Punched lath', 'Insulated lath', 'Grille', 'Other'],
    },
    {
      code: 'CFG_SHUTTER_BOTTOM_RAIL',
      prompt: 'Bottom rail condition',
      rules: [CONDITION_MEDIUM],
    },
    {
      code: 'CFG_SHUTTER_LOCKS',
      prompt: 'Locks and their condition',
      type: QuestionType.SINGLE_SELECT,
      options: ['Central lock', 'Bullet locks', 'Floor locks', 'Motor lock only', 'No lock fitted'],
    },
  ],
}

const SECTIONAL_CONFIG: SeedSection = {
  title: 'Sectional and garage door configuration',
  assetTypes: [AssetType.SECTIONAL_DOOR, AssetType.GARAGE_DOOR],
  questions: [
    {
      code: 'CFG_SECT_TRACK',
      prompt: 'Track configuration',
      type: QuestionType.SINGLE_SELECT,
      options: ['Standard lift', 'High lift', 'Vertical lift', 'Low headroom', 'Roof pitch follow'],
    },
    {
      code: 'CFG_SECT_SPRING',
      prompt: 'Counterbalance type',
      type: QuestionType.SINGLE_SELECT,
      options: ['Torsion spring', 'Extension spring', 'Counterweight', 'None'],
    },
    {
      code: 'CFG_SECT_SPRING_CONDITION',
      prompt: 'Are the springs and their restraints in serviceable condition?',
      helpText: 'A failed extension spring without a containment cable is a projectile hazard.',
      rules: [SAFETY_HIGH],
    },
    {
      code: 'CFG_SECT_PANELS',
      prompt: 'Are the panels and hinges free from damage?',
      rules: [CONDITION_MEDIUM],
    },
  ],
}

const GATE_CONFIG: SeedSection = {
  title: 'Gate configuration',
  assetTypes: [AssetType.AUTOMATIC_GATE, AssetType.SLIDING_GATE, AssetType.SWING_GATE],
  questions: [
    {
      code: 'CFG_GATE_TYPE',
      prompt: 'Gate type',
      type: QuestionType.SINGLE_SELECT,
      options: ['Sliding — tracked', 'Sliding — cantilever', 'Swing — single leaf', 'Swing — double leaf', 'Bi-fold'],
    },
    {
      code: 'CFG_GATE_MOTOR',
      prompt: 'Operator type',
      type: QuestionType.SINGLE_SELECT,
      options: ['Rack and pinion', 'Underground', 'Articulated arm', 'Ram', 'Chain', 'Manual only'],
    },
    {
      code: 'CFG_GATE_LOOPS',
      prompt: 'Are vehicle detection loops or sensors fitted and functional?',
      helpText: 'Mark not applicable where none are fitted.',
      rules: [CONDITION_MEDIUM, NOT_TESTED_NOTE],
    },
    {
      code: 'CFG_GATE_CAPTIVE',
      prompt: 'Are end stops and anti-derailment devices fitted and secure?',
      helpText: 'A sliding gate that can leave its track is a severe hazard.',
      rules: [SAFETY_CRITICAL],
    },
  ],
}

const VISUAL: SeedSection = {
  title: 'Visual inspection',
  questions: [
    {
      code: 'VIS_GENERAL',
      prompt: 'Is the general condition of the installation acceptable?',
      recommendPhoto: true,
      rules: [CONDITION_MEDIUM],
    },
    {
      code: 'VIS_HOUSEKEEPING',
      prompt: 'Is the approach and operating area clear of obstruction?',
      rules: [{ whenStatus: AnswerStatus.FAIL, severity: FindingSeverity.LOW, requireNote: true }],
    },
    {
      code: 'VIS_SEALS',
      prompt: 'Are weather seals and finishes in serviceable condition?',
      required: false,
      rules: [{ whenStatus: AnswerStatus.FAIL, severity: FindingSeverity.LOW }],
    },
    {
      code: 'VIS_PHOTO',
      prompt: 'Overall photograph of the asset as found',
      type: QuestionType.PHOTO,
      requirePhoto: true,
      helpText: 'One clear image of the whole installation, before any work.',
    },
  ],
}

export const PREVENTATIVE_MAINTENANCE: SeedTemplate = {
  slug: 'preventative-maintenance',
  name: 'Preventative maintenance',
  description:
    'General condition and safety inspection for door, shutter and gate equipment. Asset-specific sections load from the equipment type.',
  // Empty: offered for every asset type, with the configuration sections
  // narrowing themselves.
  assetTypes: [],
  sections: [
    VISUAL,
    SHUTTER_CONFIG,
    SECTIONAL_CONFIG,
    GATE_CONFIG,
    STRUCTURAL,
    MECHANICAL,
    ELECTRICAL,
    OPERATIONAL,
    PEDESTRIAN,
  ],
}

export const SAFETY_ONLY: SeedTemplate = {
  slug: 'safety-check',
  name: 'Safety check',
  description: 'The safety sections only, for a short re-attendance or a post-repair verification.',
  assetTypes: [],
  sections: [STRUCTURAL, MECHANICAL, ELECTRICAL, OPERATIONAL, PEDESTRIAN],
}

export const DEFAULT_TEMPLATES: SeedTemplate[] = [PREVENTATIVE_MAINTENANCE, SAFETY_ONLY]
