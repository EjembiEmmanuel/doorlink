/**
 * Working hours, as a set of windows per weekday.
 *
 * Pure on purpose — no imports — so the editor, the public profile and
 * the tests all read the same rules. Nothing here schedules anything or
 * blocks a booking: Doorlink has no calendar integration, so these hours
 * are a statement by the technician about when they normally work, and
 * every surface that renders them has to say so rather than implying a
 * live diary.
 *
 * Minutes since local midnight, 0..1440. A window ending at 1440 is
 * "until midnight"; nothing wraps past it, because a window that crossed
 * midnight would belong to two days and the day it was stored under
 * would stop meaning anything.
 */

export const MINUTES_IN_DAY = 1440

/** Index matches JS `Date.prototype.getDay()`. */
export const DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** Monday first, the way a working week is read here. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export interface AvailabilityWindow {
  dayOfWeek: number
  startMinute: number
  endMinute: number
}

export function isValidDay(day: number): boolean {
  return Number.isInteger(day) && day >= 0 && day <= 6
}

/**
 * Parses an `<input type="time">` value ("07:30"). Returns null rather
 * than throwing, because the caller is always validating form input and
 * wants to say which field was wrong.
 */
export function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null

  return hours * 60 + minutes
}

/** "07:30" — the value an `<input type="time">` expects back. */
export function toTimeValue(minute: number): string {
  const hours = Math.floor(minute / 60)
  const minutes = minute % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** "7:30am", "12pm", "midnight" — for reading, not for form values. */
export function formatMinute(minute: number): string {
  if (minute === 0 || minute === MINUTES_IN_DAY) return 'midnight'
  if (minute === 720) return 'noon'

  const hours24 = Math.floor(minute / 60)
  const minutes = minute % 60
  const suffix = hours24 < 12 ? 'am' : 'pm'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12

  return minutes === 0 ? `${hours12}${suffix}` : `${hours12}:${String(minutes).padStart(2, '0')}${suffix}`
}

export function formatWindow(window: AvailabilityWindow): string {
  return `${formatMinute(window.startMinute)} – ${formatMinute(window.endMinute)}`
}

/**
 * Why a window can't be stored, as a sentence, or null if it can.
 *
 * Overlap matters more than it looks. Two overlapping windows on one day
 * are not just untidy — "9am–5pm" and "1pm–3pm" together do not describe
 * anything a reader can act on, and whichever one the UI happened to
 * render first would become the answer. Rejecting the overlap keeps a
 * day's hours a list of distinct periods.
 */
export function windowProblem(candidate: AvailabilityWindow, existing: AvailabilityWindow[]): string | null {
  if (!isValidDay(candidate.dayOfWeek)) return 'Pick a day of the week.'
  if (candidate.startMinute < 0 || candidate.startMinute >= MINUTES_IN_DAY) return 'Enter a valid start time.'
  if (candidate.endMinute <= 0 || candidate.endMinute > MINUTES_IN_DAY) return 'Enter a valid finish time.'

  if (candidate.endMinute <= candidate.startMinute) {
    return 'The finish time has to be after the start time. For hours that run past midnight, add a window on each day.'
  }

  const clash = existing.find(
    (window) =>
      window.dayOfWeek === candidate.dayOfWeek &&
      candidate.startMinute < window.endMinute &&
      window.startMinute < candidate.endMinute
  )
  if (clash) {
    return `That overlaps the ${formatWindow(clash)} you already have on ${DAY_LABELS[clash.dayOfWeek]}.`
  }

  return null
}

export interface AvailabilityDay<T extends AvailabilityWindow> {
  dayOfWeek: number
  label: string
  shortLabel: string
  windows: T[]
}

/**
 * All seven days, Monday first, including the ones with no hours — a day
 * off is information, and a list that silently omits Wednesday reads as
 * though Wednesday was forgotten.
 */
export function groupByDay<T extends AvailabilityWindow>(windows: T[]): AvailabilityDay<T>[] {
  return WEEK_ORDER.map((dayOfWeek) => ({
    dayOfWeek,
    label: DAY_LABELS[dayOfWeek],
    shortLabel: DAY_SHORT[dayOfWeek],
    windows: windows
      .filter((window) => window.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.startMinute - b.startMinute),
  }))
}

/**
 * A one-line summary for a profile card, e.g. "Mon–Fri, Sat". Days, not
 * times: the times differ per day and a card has no room to be accurate
 * about that, so it says which days and links to the rest.
 */
export function summariseDays(windows: AvailabilityWindow[]): string | null {
  const days = WEEK_ORDER.filter((day) => windows.some((window) => window.dayOfWeek === day))
  if (days.length === 0) return null

  const runs: number[][] = []
  for (const day of days) {
    const last = runs[runs.length - 1]
    const previousIndex = last ? WEEK_ORDER.indexOf(last[last.length - 1] as (typeof WEEK_ORDER)[number]) : -1
    if (last && WEEK_ORDER.indexOf(day) === previousIndex + 1) last.push(day)
    else runs.push([day])
  }

  return runs
    .map((run) =>
      run.length >= 3
        ? `${DAY_SHORT[run[0]]}–${DAY_SHORT[run[run.length - 1]]}`
        : run.map((day) => DAY_SHORT[day]).join(', ')
    )
    .join(', ')
}
