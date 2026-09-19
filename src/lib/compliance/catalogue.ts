/**
 * What is in the Compliance & Safety Pack.
 *
 * Pure data, no imports, so the landing page, the pack view and the
 * tests all describe the same fifteen documents. The codes, section
 * numbers, titles and purposes are transcribed from the source pack
 * (DL-IDX-001) — they are its identifiers, not ours to reword, because a
 * business filing DL-WHS-003 needs that number to keep meaning the same
 * thing on the page and in their register.
 */

export interface ComplianceSection {
  number: string
  title: string
}

export interface ComplianceDocument {
  /** The document number printed on every page, e.g. "DL-WHS-002". */
  code: string
  sectionNumber: string
  title: string
  /** What the document is for, from the pack's own contents page. */
  purpose: string
  /** Pages in the source pack, for an honest "what you get" figure. */
  pages: number
  /**
   * True where the document contains jurisdiction-specific legislation.
   * The source pack lists New South Wales instruments and carries a
   * "CHECK YOUR JURISDICTION" notice; anything generated for another
   * state has to say so rather than quietly presenting NSW law as the
   * reader's own.
   */
  jurisdictionSpecific?: boolean
  /**
   * True where the source pack says a competent professional must review
   * the wording before use. Carried through to the rendered document.
   */
  needsProfessionalReview?: boolean
}

export const COMPLIANCE_SECTIONS: ComplianceSection[] = [
  { number: '01', title: 'Business & Document Control' },
  { number: '02', title: 'Compliance' },
  { number: '03', title: 'Work Health & Safety' },
  { number: '04', title: 'Risk Management' },
  { number: '05', title: 'Safe Work Procedures' },
  { number: '06', title: 'Inspections & Checklists' },
  { number: '07', title: 'Incidents & Reporting' },
  { number: '08', title: 'Emergency Management' },
  { number: '09', title: 'Customer & Job Documentation' },
]

export const COMPLIANCE_DOCUMENTS: ComplianceDocument[] = [
  {
    code: 'DL-BUS-001',
    sectionNumber: '01',
    title: 'Business Information & Document Register',
    purpose:
      'Records your business, people and insurances once. Every other document reuses these details, and the register here tracks the version of each one.',
    pages: 4,
  },
  {
    code: 'DL-COMP-001',
    sectionNumber: '02',
    title: 'Contractor Compliance Requirements & Declaration',
    purpose:
      'Issued to contractors before they start work: the legislation they work under, their status, and the insurances and licences they must produce and keep current.',
    pages: 3,
    jurisdictionSpecific: true,
  },
  {
    code: 'DL-WHS-001',
    sectionNumber: '03',
    title: 'Workplace Health & Safety Policy Statement',
    purpose:
      'The signed safety commitment that clients, principal contractors and insurers usually ask to see first. Display it where workers can read it.',
    pages: 2,
    jurisdictionSpecific: true,
  },
  {
    code: 'DL-WHS-002',
    sectionNumber: '03',
    title: 'Health & Safety Management Plan',
    purpose:
      'The parent document for your safety system: responsibilities, the risk process, key hazards and controls, training requirements and stage-by-stage site procedures.',
    pages: 5,
  },
  {
    code: 'DL-WHS-003',
    sectionNumber: '03',
    title: 'WHS Responsibilities Statement',
    purpose:
      'Evidence of how safety duties are communicated — procedures, inductions, toolbox talks and reviews — with an acknowledgement register workers sign.',
    pages: 3,
  },
  {
    code: 'DL-WHS-004',
    sectionNumber: '03',
    title: 'WHS Legislation & Continuous Improvement Statement',
    purpose:
      'Shows how you track legislative and standards change and feed it back into work procedures, with a dated review log.',
    pages: 3,
    jurisdictionSpecific: true,
  },
  {
    code: 'DL-WHS-005',
    sectionNumber: '03',
    title: 'Safety Induction Statement & Record',
    purpose:
      'Delivers and records the induction every worker and subcontractor must complete before starting, covering rights, hazards and safe work procedures.',
    pages: 4,
  },
  {
    code: 'DL-WHS-006',
    sectionNumber: '03',
    title: 'Drug, Alcohol & Fatigue Management Policy',
    purpose:
      'Fitness for duty, your testing arrangements and shift and rest limits, with a rest and break log. Review the flagged sections with an employment adviser.',
    pages: 4,
    needsProfessionalReview: true,
  },
  {
    code: 'DL-WHS-007',
    sectionNumber: '03',
    title: 'Vehicle First Aid Kit Policy & Compliance Log',
    purpose:
      'Keeps a compliant, in-date first aid kit in every company and subcontractor vehicle, with a weekly signed check.',
    pages: 4,
  },
  {
    code: 'DL-RISK-001',
    sectionNumber: '04',
    title: 'Risk Register & Risk Assessment',
    purpose:
      'Your standing list of trade hazards and controls, the 5 x 5 risk matrix and action table, and the blank assessment completed on site before work starts.',
    pages: 5,
  },
  {
    code: 'DL-SWMS-001',
    sectionNumber: '05',
    title: 'Safe Work Method Statement',
    purpose:
      'Required for high-risk construction work. Scope, PPE, high-risk categories, legislation and standards, risk matrix, full job safety analysis and worker sign-on.',
    pages: 6,
    jurisdictionSpecific: true,
  },
  {
    code: 'DL-INSP-001',
    sectionNumber: '06',
    title: 'Master Maintenance Checklist',
    purpose:
      'Per-asset service record covering structure, drive system, electrical and safety controls, lubrication and cycle testing, with defects, photos and client sign-off.',
    pages: 5,
  },
  {
    code: 'DL-INC-001',
    sectionNumber: '07',
    title: 'Work Incident, Near Miss & Hazard Report',
    purpose:
      'Injuries, near misses, hazards and property damage: what happened, who was involved, contributing factors and the corrective actions that follow.',
    pages: 5,
  },
  {
    code: 'DL-EMG-001',
    sectionNumber: '08',
    title: 'Business Continuity & Emergency Management Plan',
    purpose:
      'Emergency contacts, response steps, continuity actions, drill schedule and the site-specific arrangements workers need to know before they need them.',
    pages: 5,
  },
  {
    code: 'DL-JOB-001',
    sectionNumber: '09',
    title: 'Warranty Certificate',
    purpose:
      'Issued on completion: works performed, equipment and serial numbers, warranty periods and exclusions, maintenance recommendation and handover checklist.',
    pages: 4,
    needsProfessionalReview: true,
  },
]

export const DOCUMENT_COUNT = COMPLIANCE_DOCUMENTS.length
export const SECTION_COUNT = COMPLIANCE_SECTIONS.length
export const TOTAL_PAGES = COMPLIANCE_DOCUMENTS.reduce((sum, doc) => sum + doc.pages, 0)

export function documentsBySection(): Array<{ section: ComplianceSection; documents: ComplianceDocument[] }> {
  return COMPLIANCE_SECTIONS.map((section) => ({
    section,
    documents: COMPLIANCE_DOCUMENTS.filter((doc) => doc.sectionNumber === section.number),
  }))
}

export function findDocument(code: string): ComplianceDocument | null {
  return COMPLIANCE_DOCUMENTS.find((doc) => doc.code === code) ?? null
}

/**
 * The disclaimer the source pack prints on every document. It travels
 * with the content wherever the content goes — a generated pack that
 * dropped it would be claiming more than the templates do.
 */
export const COMPLIANCE_DISCLAIMER =
  'IMPORTANT: This document is provided as a general compliance and documentation template. Businesses must ensure that the information, procedures and controls are reviewed and adapted to their specific operations, jurisdiction, equipment, workers and legal obligations. Use of this template does not constitute legal advice and does not independently guarantee compliance with any law, regulation, standard, licence or insurance requirement.'
