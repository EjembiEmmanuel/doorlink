// Model-number normalisation.
//
// The same opener is written MT60, MT-60, MT 60, mt60, and "MT60 ".
// A technician typing what is stamped on the motor, a homeowner reading
// a faded label, and a distributor's catalogue will disagree about
// separators and case every time.
//
// The rule: normalise for matching, never for display. The manufacturer's
// own designation is what appears on a result page (brief §17), and
// nothing here rewrites it — these functions only produce a key to
// compare on.

/**
 * The matching key. Strips case and every separator manufacturers vary
 * on, leaving letters and digits.
 *
 * Deliberately not stripping anything else: "MT60/2" and "MT602"
 * collapsing together would be a wrong match, not a lenient one, so
 * slashes survive as a boundary the caller can still see via
 * `normaliseLoose` if it wants that behaviour explicitly.
 */
export function normaliseModel(input: string): string {
  return input.toLowerCase().replace(/[\s\-_.]+/g, '')
}

/** Everything non-alphanumeric removed. Wider, and wrong more often. */
export function normaliseLoose(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * Splits a code into its letter and digit runs: "MT60" → ["mt", "60"].
 * Used to generate the alias spellings below and to compare a code's
 * shape when an exact match fails.
 */
export function segments(input: string): string[] {
  return normaliseModel(input).match(/[a-z]+|[0-9]+/g) ?? []
}

/**
 * The spellings a person might plausibly type for one model code.
 *
 * Generated rather than hand-listed, so adding a model does not mean
 * remembering to write out its variants. Always includes the original,
 * so an exact match on what the manufacturer printed is never lost.
 */
export function aliasSpellings(modelCode: string): string[] {
  const parts = segments(modelCode)
  const out = new Set<string>([modelCode, modelCode.toUpperCase(), modelCode.toLowerCase()])

  if (parts.length > 1) {
    const joined = parts.join('')
    out.add(joined)
    out.add(joined.toUpperCase())
    out.add(parts.join('-'))
    out.add(parts.join('-').toUpperCase())
    out.add(parts.join(' '))
    out.add(parts.join(' ').toUpperCase())
  }

  return [...out].filter((value) => value.trim().length > 0)
}

/**
 * Does a query plausibly refer to this model code?
 *
 * Returns the *kind* of match rather than a boolean, because the caller
 * needs to rank them differently and, more importantly, needs to tell a
 * reader "this is your model" apart from "this might be your model"
 * (brief §10). A prefix match is a suggestion, never a conclusion.
 */
export type ModelMatch = 'exact' | 'normalised' | 'prefix' | 'contains' | 'none'

export function matchModel(query: string, modelCode: string): ModelMatch {
  const q = query.trim()
  if (q.length === 0) return 'none'
  if (q === modelCode) return 'exact'

  const nq = normaliseModel(q)
  const nm = normaliseModel(modelCode)
  if (nq.length === 0 || nm.length === 0) return 'none'
  if (nq === nm) return 'normalised'

  // A short query matches far too much. "M" would otherwise "prefix
  // match" every model a manufacturer has ever made and drown the one
  // the person actually wants.
  if (nq.length >= 3 && nm.startsWith(nq)) return 'prefix'
  if (nq.length >= 4 && nm.includes(nq)) return 'contains'
  return 'none'
}

/** Whether a match is firm enough to state as fact rather than offer as a guess. */
export function isConfidentMatch(match: ModelMatch): boolean {
  return match === 'exact' || match === 'normalised'
}
