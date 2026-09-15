import { describe, expect, it } from 'vitest'
import {
  formatMinute,
  formatWindow,
  groupByDay,
  parseTime,
  summariseDays,
  toTimeValue,
  windowProblem,
} from './availability'

describe('parseTime', () => {
  it('reads what an input[type=time] sends', () => {
    expect(parseTime('07:30')).toBe(450)
    expect(parseTime('00:00')).toBe(0)
    expect(parseTime('23:59')).toBe(1439)
  })

  it('rejects anything that is not a time', () => {
    expect(parseTime('')).toBeNull()
    expect(parseTime('7.30')).toBeNull()
    expect(parseTime('24:00')).toBeNull()
    expect(parseTime('12:60')).toBeNull()
  })

  it('round-trips through toTimeValue', () => {
    for (const value of ['00:00', '09:05', '13:45', '23:59']) {
      expect(toTimeValue(parseTime(value)!)).toBe(value)
    }
  })
})

describe('formatMinute', () => {
  it('names the two times people do not read as numbers', () => {
    expect(formatMinute(0)).toBe('midnight')
    expect(formatMinute(1440)).toBe('midnight')
    expect(formatMinute(720)).toBe('noon')
  })

  it('drops the minutes when there are none', () => {
    expect(formatMinute(420)).toBe('7am')
    expect(formatMinute(1020)).toBe('5pm')
  })

  it('keeps them when there are', () => {
    expect(formatMinute(450)).toBe('7:30am')
    expect(formatMinute(1035)).toBe('5:15pm')
  })

  it('does not render 12pm as 0pm', () => {
    expect(formatMinute(750)).toBe('12:30pm')
    expect(formatMinute(30)).toBe('12:30am')
  })
})

describe('windowProblem', () => {
  const nineToFive = { dayOfWeek: 1, startMinute: 540, endMinute: 1020 }

  it('accepts a window that clears every rule', () => {
    expect(windowProblem(nineToFive, [])).toBeNull()
  })

  it('refuses a finish at or before the start', () => {
    expect(windowProblem({ dayOfWeek: 1, startMinute: 540, endMinute: 540 }, [])).toMatch(/after the start/)
    expect(windowProblem({ dayOfWeek: 1, startMinute: 1020, endMinute: 540 }, [])).toMatch(/after the start/)
  })

  it('refuses an overlap on the same day and says which one', () => {
    const problem = windowProblem({ dayOfWeek: 1, startMinute: 780, endMinute: 900 }, [nineToFive])
    expect(problem).toMatch(/overlaps/)
    expect(problem).toContain('Monday')
  })

  it('allows windows that merely touch', () => {
    expect(windowProblem({ dayOfWeek: 1, startMinute: 1020, endMinute: 1200 }, [nineToFive])).toBeNull()
  })

  it('allows the same hours on a different day', () => {
    expect(windowProblem({ ...nineToFive, dayOfWeek: 2 }, [nineToFive])).toBeNull()
  })

  it('refuses a day outside the week', () => {
    expect(windowProblem({ dayOfWeek: 7, startMinute: 540, endMinute: 1020 }, [])).toMatch(/day of the week/)
  })

  it('allows a window that runs to midnight but not past it', () => {
    expect(windowProblem({ dayOfWeek: 5, startMinute: 1200, endMinute: 1440 }, [])).toBeNull()
    expect(windowProblem({ dayOfWeek: 5, startMinute: 1200, endMinute: 1500 }, [])).toMatch(/valid finish/)
  })
})

describe('groupByDay', () => {
  it('returns all seven days, Monday first, empty ones included', () => {
    const days = groupByDay([{ dayOfWeek: 3, startMinute: 540, endMinute: 1020 }])
    expect(days).toHaveLength(7)
    expect(days[0].label).toBe('Monday')
    expect(days[6].label).toBe('Sunday')
    expect(days.filter((day) => day.windows.length > 0)).toHaveLength(1)
  })

  it('sorts a day by start time', () => {
    const days = groupByDay([
      { dayOfWeek: 1, startMinute: 780, endMinute: 900 },
      { dayOfWeek: 1, startMinute: 420, endMinute: 660 },
    ])
    expect(days[0].windows.map((w) => w.startMinute)).toEqual([420, 780])
  })
})

describe('summariseDays', () => {
  it('is null when nothing is set, rather than an empty string', () => {
    expect(summariseDays([])).toBeNull()
  })

  it('collapses a run of three or more', () => {
    const weekdays = [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startMinute: 540, endMinute: 1020 }))
    expect(summariseDays(weekdays)).toBe('Mon–Fri')
  })

  it('lists short runs rather than collapsing them', () => {
    expect(
      summariseDays([
        { dayOfWeek: 1, startMinute: 540, endMinute: 1020 },
        { dayOfWeek: 2, startMinute: 540, endMinute: 1020 },
      ])
    ).toBe('Mon, Tue')
  })

  it('keeps separate runs separate', () => {
    const windows = [1, 2, 3, 4, 5, 0].map((dayOfWeek) => ({ dayOfWeek, startMinute: 540, endMinute: 1020 }))
    expect(summariseDays(windows)).toBe('Mon–Fri, Sun')
  })

  it('counts a day once however many windows it has', () => {
    expect(
      summariseDays([
        { dayOfWeek: 6, startMinute: 420, endMinute: 660 },
        { dayOfWeek: 6, startMinute: 780, endMinute: 900 },
      ])
    ).toBe('Sat')
  })
})

describe('formatWindow', () => {
  it('reads as a period', () => {
    expect(formatWindow({ dayOfWeek: 1, startMinute: 450, endMinute: 1020 })).toBe('7:30am – 5pm')
  })
})
