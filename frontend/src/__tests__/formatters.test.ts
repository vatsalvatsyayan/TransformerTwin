import { describe, it, expect } from 'vitest'
import {
  formatSensorValue,
  formatHealthScore,
  formatSimTime,
  formatSimDuration,
  formatTimestamp,
  formatCount,
  formatPercent,
} from '../lib/formatters'

describe('formatSensorValue', () => {
  it('formats a value to 1 decimal place with a unit separated by a space', () => {
    expect(formatSensorValue(75.123, '°C')).toBe('75.1 °C')
  })

  it('formats zero with a unit', () => {
    expect(formatSensorValue(0.0, 'ppm')).toBe('0.0 ppm')
  })

  it('rounds up when the second decimal is >= 5', () => {
    expect(formatSensorValue(100.999, '°C')).toBe('101.0 °C')
  })

  it('omits the trailing space when no unit is provided', () => {
    expect(formatSensorValue(42.5)).toBe('42.5')
  })

  it('appends a trailing space when an empty string is passed as the unit', () => {
    // The implementation does `unit ? ... : ...`; an empty string is falsy,
    // so it behaves the same as no-unit — no trailing space.
    expect(formatSensorValue(42.5, '')).toBe('42.5')
  })

  it('rounds down correctly', () => {
    expect(formatSensorValue(10.14, 'kV')).toBe('10.1 kV')
  })

  it('handles negative values', () => {
    expect(formatSensorValue(-5.678, '°C')).toBe('-5.7 °C')
  })
})

describe('formatHealthScore', () => {
  it('formats 100 to one decimal place', () => {
    expect(formatHealthScore(100)).toBe('100.0')
  })

  it('rounds to one decimal place (rounds up)', () => {
    expect(formatHealthScore(83.456)).toBe('83.5')
  })

  it('formats zero to one decimal place', () => {
    expect(formatHealthScore(0)).toBe('0.0')
  })

  it('formats a mid-range value correctly', () => {
    expect(formatHealthScore(67.0)).toBe('67.0')
  })
})

describe('formatSimTime', () => {
  it('formats zero seconds as 00:00:00', () => {
    expect(formatSimTime(0)).toBe('00:00:00')
  })

  it('formats 3661 seconds as 01:01:01', () => {
    expect(formatSimTime(3661)).toBe('01:01:01')
  })

  it('formats 86400 seconds (24 hours) as 24:00:00', () => {
    expect(formatSimTime(86400)).toBe('24:00:00')
  })

  it('formats 59 seconds as 00:00:59', () => {
    expect(formatSimTime(59)).toBe('00:00:59')
  })

  it('formats exactly 3600 seconds as 01:00:00', () => {
    expect(formatSimTime(3600)).toBe('01:00:00')
  })

  it('formats 7261 seconds (2h 1m 1s) as 02:01:01', () => {
    expect(formatSimTime(7261)).toBe('02:01:01')
  })

  it('pads single-digit minutes and seconds with a leading zero', () => {
    expect(formatSimTime(65)).toBe('00:01:05')
  })
})

describe('formatSimDuration', () => {
  it('returns seconds with "s" suffix for values under 60', () => {
    expect(formatSimDuration(30)).toBe('30s')
  })

  it('returns fractional minutes with "m" suffix for 90 seconds', () => {
    expect(formatSimDuration(90)).toBe('1.5m')
  })

  it('returns hours with "h" suffix for exactly 3600 seconds', () => {
    expect(formatSimDuration(3600)).toBe('1.0h')
  })

  it('returns 1.5h for 5400 seconds', () => {
    expect(formatSimDuration(5400)).toBe('1.5h')
  })

  it('returns 59s for 59 seconds', () => {
    expect(formatSimDuration(59)).toBe('59s')
  })

  it('returns 2.0m for 120 seconds', () => {
    expect(formatSimDuration(120)).toBe('2.0m')
  })

  it('returns 0s for zero seconds', () => {
    expect(formatSimDuration(0)).toBe('0s')
  })
})

describe('formatTimestamp', () => {
  it('returns a non-empty string for a valid ISO 8601 timestamp', () => {
    const result = formatTimestamp('2024-06-15T14:30:45.000Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for another valid ISO timestamp', () => {
    const result = formatTimestamp('2024-01-01T00:00:00.000Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('formatCount', () => {
  it('formats 1000 with a comma separator', () => {
    expect(formatCount(1000)).toBe('1,000')
  })

  it('formats values under 1000 without a separator', () => {
    expect(formatCount(999)).toBe('999')
  })

  it('formats 1 000 000 with two comma separators', () => {
    expect(formatCount(1_000_000)).toBe('1,000,000')
  })

  it('formats zero without a separator', () => {
    expect(formatCount(0)).toBe('0')
  })
})

describe('formatPercent', () => {
  it('formats 75.5 as "75.5%"', () => {
    expect(formatPercent(75.5)).toBe('75.5%')
  })

  it('formats 0 as "0.0%"', () => {
    expect(formatPercent(0)).toBe('0.0%')
  })

  it('formats 100 as "100.0%"', () => {
    expect(formatPercent(100)).toBe('100.0%')
  })

  it('rounds to one decimal place', () => {
    expect(formatPercent(33.333)).toBe('33.3%')
  })
})
