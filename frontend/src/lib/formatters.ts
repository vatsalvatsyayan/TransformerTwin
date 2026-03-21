// Number formatting, date formatting, and unit display helpers

/** Format a sensor value to 1 decimal place */
export function formatSensorValue(value: number, unit?: string): string {
  const formatted = value.toFixed(1)
  return unit ? `${formatted} ${unit}` : formatted
}

/** Format a health score to 1 decimal place */
export function formatHealthScore(score: number): string {
  return score.toFixed(1)
}

/** Format simulation time (seconds) to HH:MM:SS */
export function formatSimTime(simSeconds: number): string {
  const h = Math.floor(simSeconds / 3600)
  const m = Math.floor((simSeconds % 3600) / 60)
  const s = Math.floor(simSeconds % 60)
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

/** Format simulation time to human-readable duration */
export function formatSimDuration(simSeconds: number): string {
  if (simSeconds < 60) return `${simSeconds.toFixed(0)}s`
  if (simSeconds < 3600) return `${(simSeconds / 60).toFixed(1)}m`
  return `${(simSeconds / 3600).toFixed(1)}h`
}

/** Format an ISO 8601 timestamp to a short wall-clock string */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** Format a number with comma separators */
export function formatCount(n: number): string {
  return n.toLocaleString()
}

/** Format a percentage with 1 decimal */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}
