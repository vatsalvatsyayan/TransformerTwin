import { describe, it, expect, beforeEach } from 'vitest'
import { useStore, SENSOR_HISTORY_BUFFER_SIZE } from '../store/index'
import type { Alert } from '../types/alerts'
import type { SensorReading } from '../types/sensors'
import type { DGAAnalysisResponse, DuvalResult } from '../types/dga'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal SensorReading used across tests */
function makeSensorReading(value: number): SensorReading {
  return { value, unit: '°C', status: 'NORMAL' }
}

/** Minimal Alert factory */
function makeAlert(id: number, acknowledged = false): Alert {
  return {
    id,
    timestamp: '2026-01-01T00:00:00Z',
    severity: 'WARNING',
    title: `Alert ${id}`,
    description: 'Test alert',
    source: 'THRESHOLD',
    sensor_ids: ['TOP_OIL_TEMP'],
    failure_mode_id: null,
    recommended_actions: [],
    acknowledged,
    acknowledged_at: null,
    sim_time: 0,
  }
}

/** Minimal DuvalResult factory */
function makeDuvalResult(zone: DuvalResult['zone']): DuvalResult {
  return {
    pct_ch4: 33.3,
    pct_c2h4: 33.3,
    pct_c2h2: 33.4,
    zone,
    zone_label: zone === 'NONE' ? 'Indeterminate' : zone,
    point: { x: 0.333, y: 0.333, z: 0.334 },
  }
}

/** Minimal DGAAnalysisResponse factory */
function makeDGAAnalysis(zone: DuvalResult['zone']): DGAAnalysisResponse {
  return {
    timestamp: '2026-01-01T00:00:00Z',
    duval: makeDuvalResult(zone),
    tdcg: { value: 100, unit: 'ppm', status: 'NORMAL' },
    co2_co_ratio: { value: 5.0, interpretation: 'Normal' },
    gas_rates: {},
  }
}

/** Reset fields touched by the tests before each test case */
function resetStore(): void {
  useStore.setState({
    readings: {},
    history: {},
    lastSimTime: 0,
    overallScore: 100,
    previousScore: 100,
    status: 'GOOD',
    components: {},
    alerts: [],
    activeCount: 0,
    totalCount: 0,
    analysis: null,
    duvalHistory: [],
    mode: 'live',
    playbackPosition: null,
    isPlaying: false,
  })
}

// ---------------------------------------------------------------------------
// updateReadings
// ---------------------------------------------------------------------------

describe('updateReadings action', () => {
  beforeEach(resetStore)

  it('stores sensor values in readings', () => {
    useStore.getState().updateReadings(
      'thermal',
      { TOP_OIL_TEMP: makeSensorReading(75) },
      1000,
      '2026-01-01T00:00:00Z',
    )

    const { readings } = useStore.getState()
    expect(readings.TOP_OIL_TEMP).toBeDefined()
    expect(readings.TOP_OIL_TEMP?.value).toBe(75)
  })

  it('accumulates history entries with each call', () => {
    const ts = '2026-01-01T00:00:00Z'
    useStore.getState().updateReadings('thermal', { TOP_OIL_TEMP: makeSensorReading(70) }, 1, ts)
    useStore.getState().updateReadings('thermal', { TOP_OIL_TEMP: makeSensorReading(71) }, 2, ts)
    useStore.getState().updateReadings('thermal', { TOP_OIL_TEMP: makeSensorReading(72) }, 3, ts)

    const buf = useStore.getState().history.TOP_OIL_TEMP ?? []
    expect(buf.length).toBe(3)
    expect(buf[2].value).toBe(72)
  })

  it('trims the oldest entry when buffer is at capacity', () => {
    // Fill buffer exactly to capacity
    const ts = '2026-01-01T00:00:00Z'
    for (let i = 0; i < SENSOR_HISTORY_BUFFER_SIZE; i++) {
      useStore.getState().updateReadings(
        'thermal',
        { TOP_OIL_TEMP: makeSensorReading(i) },
        i,
        ts,
      )
    }

    // Buffer should be at capacity now
    expect((useStore.getState().history.TOP_OIL_TEMP ?? []).length).toBe(SENSOR_HISTORY_BUFFER_SIZE)

    // One more entry should evict the oldest (value 0) and add the new one
    useStore.getState().updateReadings(
      'thermal',
      { TOP_OIL_TEMP: makeSensorReading(9999) },
      SENSOR_HISTORY_BUFFER_SIZE,
      ts,
    )

    const buf = useStore.getState().history.TOP_OIL_TEMP ?? []
    expect(buf.length).toBe(SENSOR_HISTORY_BUFFER_SIZE)
    expect(buf[0].value).toBe(1)          // first entry evicted
    expect(buf[buf.length - 1].value).toBe(9999) // newest at end
  })

  it('updates lastSimTime to the passed simTime', () => {
    useStore.getState().updateReadings(
      'thermal',
      { TOP_OIL_TEMP: makeSensorReading(80) },
      42,
      '2026-01-01T00:00:00Z',
    )

    expect(useStore.getState().lastSimTime).toBe(42)
  })

  it('merges multiple sensors from a single call', () => {
    useStore.getState().updateReadings(
      'thermal',
      {
        TOP_OIL_TEMP: makeSensorReading(65),
        WINDING_TEMP: makeSensorReading(90),
      },
      10,
      '2026-01-01T00:00:00Z',
    )

    const { readings } = useStore.getState()
    expect(readings.TOP_OIL_TEMP?.value).toBe(65)
    expect(readings.WINDING_TEMP?.value).toBe(90)
  })
})

// ---------------------------------------------------------------------------
// updateHealth
// ---------------------------------------------------------------------------

describe('updateHealth action', () => {
  beforeEach(resetStore)

  it('sets status to GOOD for score 90', () => {
    useStore.getState().updateHealth(90, 100, {}, '2026-01-01T00:00:00Z')
    expect(useStore.getState().status).toBe('GOOD')
    expect(useStore.getState().overallScore).toBe(90)
  })

  it('sets status to FAIR for score 70', () => {
    useStore.getState().updateHealth(70, 90, {}, '2026-01-01T00:00:00Z')
    expect(useStore.getState().status).toBe('FAIR')
  })

  it('sets status to POOR for score 50', () => {
    useStore.getState().updateHealth(50, 70, {}, '2026-01-01T00:00:00Z')
    expect(useStore.getState().status).toBe('POOR')
  })

  it('sets status to CRITICAL for score 30', () => {
    useStore.getState().updateHealth(30, 50, {}, '2026-01-01T00:00:00Z')
    expect(useStore.getState().status).toBe('CRITICAL')
  })

  it('score exactly 80 → GOOD (inclusive lower boundary)', () => {
    useStore.getState().updateHealth(80, 90, {}, '2026-01-01T00:00:00Z')
    expect(useStore.getState().status).toBe('GOOD')
  })

  it('score exactly 60 → FAIR (inclusive lower boundary)', () => {
    useStore.getState().updateHealth(60, 80, {}, '2026-01-01T00:00:00Z')
    expect(useStore.getState().status).toBe('FAIR')
  })

  it('score exactly 40 → POOR (inclusive lower boundary)', () => {
    useStore.getState().updateHealth(40, 60, {}, '2026-01-01T00:00:00Z')
    expect(useStore.getState().status).toBe('POOR')
  })

  it('updates previousScore', () => {
    useStore.getState().updateHealth(75, 85, {}, '2026-01-01T00:00:00Z')
    expect(useStore.getState().previousScore).toBe(85)
  })
})

// ---------------------------------------------------------------------------
// addAlert
// ---------------------------------------------------------------------------

describe('addAlert action', () => {
  beforeEach(resetStore)

  it('adds the alert to the alerts array', () => {
    useStore.getState().addAlert(makeAlert(1))
    expect(useStore.getState().alerts).toHaveLength(1)
    expect(useStore.getState().alerts[0].id).toBe(1)
  })

  it('increments activeCount for an unacknowledged alert', () => {
    useStore.getState().addAlert(makeAlert(1, false))
    expect(useStore.getState().activeCount).toBe(1)
  })

  it('does NOT increment activeCount for an already-acknowledged alert', () => {
    useStore.getState().addAlert(makeAlert(1, true))
    expect(useStore.getState().activeCount).toBe(0)
    expect(useStore.getState().totalCount).toBe(1)
  })

  it('increments totalCount with each new unique alert', () => {
    useStore.getState().addAlert(makeAlert(1))
    useStore.getState().addAlert(makeAlert(2))
    expect(useStore.getState().totalCount).toBe(2)
  })

  it('does NOT insert a duplicate (same id) and does NOT change counts', () => {
    useStore.getState().addAlert(makeAlert(5))
    useStore.getState().addAlert(makeAlert(5)) // duplicate

    expect(useStore.getState().alerts).toHaveLength(1)
    expect(useStore.getState().activeCount).toBe(1)
    expect(useStore.getState().totalCount).toBe(1)
  })

  it('prepends new alerts so the most recent is first', () => {
    useStore.getState().addAlert(makeAlert(10))
    useStore.getState().addAlert(makeAlert(11))
    expect(useStore.getState().alerts[0].id).toBe(11)
  })
})

// ---------------------------------------------------------------------------
// acknowledgeAlert
// ---------------------------------------------------------------------------

describe('acknowledgeAlert action', () => {
  beforeEach(resetStore)

  it('marks the alert as acknowledged', () => {
    useStore.getState().addAlert(makeAlert(1))
    useStore.getState().acknowledgeAlert(1, '2026-01-01T01:00:00Z')

    const alert = useStore.getState().alerts.find((a) => a.id === 1)
    expect(alert?.acknowledged).toBe(true)
    expect(alert?.acknowledged_at).toBe('2026-01-01T01:00:00Z')
  })

  it('decrements activeCount by 1', () => {
    useStore.getState().addAlert(makeAlert(1))
    useStore.getState().addAlert(makeAlert(2))
    expect(useStore.getState().activeCount).toBe(2)

    useStore.getState().acknowledgeAlert(1, '2026-01-01T01:00:00Z')
    expect(useStore.getState().activeCount).toBe(1)
  })

  it('does NOT decrement activeCount when acknowledging an already-acknowledged alert', () => {
    useStore.getState().addAlert(makeAlert(1, true)) // already acknowledged
    useStore.setState({ activeCount: 0 })            // sanity: activeCount stays 0

    useStore.getState().acknowledgeAlert(1, '2026-01-01T01:00:00Z')
    expect(useStore.getState().activeCount).toBe(0)
  })

  it('leaves state unchanged when the alert ID does not exist', () => {
    useStore.getState().addAlert(makeAlert(1))
    useStore.getState().acknowledgeAlert(999, '2026-01-01T01:00:00Z')

    expect(useStore.getState().activeCount).toBe(1)
    expect(useStore.getState().alerts[0].acknowledged).toBe(false)
  })

  it('does not allow activeCount to drop below 0', () => {
    // Simulate an edge case: active count is already 0
    useStore.setState({ activeCount: 0 })
    useStore.getState().addAlert(makeAlert(1, true)) // acknowledged, no increment

    useStore.getState().acknowledgeAlert(1, '2026-01-01T01:00:00Z')
    expect(useStore.getState().activeCount).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// setDGAAnalysis
// ---------------------------------------------------------------------------

describe('setDGAAnalysis action', () => {
  beforeEach(resetStore)

  it('does NOT grow duvalHistory when zone is NONE', () => {
    useStore.getState().setDGAAnalysis(makeDGAAnalysis('NONE'))
    expect(useStore.getState().duvalHistory).toHaveLength(0)
  })

  it('stores the analysis regardless of zone', () => {
    const dga = makeDGAAnalysis('NONE')
    useStore.getState().setDGAAnalysis(dga)
    expect(useStore.getState().analysis).not.toBeNull()
  })

  it('grows duvalHistory when zone is a valid fault zone (T1)', () => {
    useStore.getState().setDGAAnalysis(makeDGAAnalysis('T1'))
    expect(useStore.getState().duvalHistory).toHaveLength(1)
    expect(useStore.getState().duvalHistory[0].zone).toBe('T1')
  })

  it('grows duvalHistory for each call with a non-NONE zone', () => {
    useStore.getState().setDGAAnalysis(makeDGAAnalysis('T1'))
    useStore.getState().setDGAAnalysis(makeDGAAnalysis('D1'))
    useStore.getState().setDGAAnalysis(makeDGAAnalysis('DT'))
    expect(useStore.getState().duvalHistory).toHaveLength(3)
  })

  it('caps duvalHistory at 20 entries', () => {
    for (let i = 0; i < 25; i++) {
      useStore.getState().setDGAAnalysis(makeDGAAnalysis('T2'))
    }
    expect(useStore.getState().duvalHistory).toHaveLength(20)
  })

  it('preserves the most recent 20 entries (FIFO eviction)', () => {
    // Fill with T1 entries, then add T3 entries beyond the cap
    for (let i = 0; i < 20; i++) {
      useStore.getState().setDGAAnalysis(makeDGAAnalysis('T1'))
    }
    useStore.getState().setDGAAnalysis(makeDGAAnalysis('T3'))

    const history = useStore.getState().duvalHistory
    expect(history).toHaveLength(20)
    expect(history[history.length - 1].zone).toBe('T3')
  })
})

// ---------------------------------------------------------------------------
// Playback mode actions
// ---------------------------------------------------------------------------

describe('Playback mode actions', () => {
  beforeEach(resetStore)

  it('enterPlayback sets mode to playback and stores position', () => {
    useStore.getState().enterPlayback('pos1')
    expect(useStore.getState().mode).toBe('playback')
    expect(useStore.getState().playbackPosition).toBe('pos1')
  })

  it('enterPlayback resets isPlaying to false', () => {
    useStore.setState({ isPlaying: true })
    useStore.getState().enterPlayback('pos1')
    expect(useStore.getState().isPlaying).toBe(false)
  })

  it('exitPlayback sets mode to live and clears position', () => {
    useStore.getState().enterPlayback('pos1')
    useStore.getState().exitPlayback()
    expect(useStore.getState().mode).toBe('live')
    expect(useStore.getState().playbackPosition).toBeNull()
  })

  it('exitPlayback resets isPlaying to false', () => {
    useStore.getState().enterPlayback('pos1')
    useStore.setState({ isPlaying: true })
    useStore.getState().exitPlayback()
    expect(useStore.getState().isPlaying).toBe(false)
  })

  it('setIsPlaying(true) sets isPlaying to true', () => {
    useStore.getState().setIsPlaying(true)
    expect(useStore.getState().isPlaying).toBe(true)
  })

  it('setIsPlaying(false) sets isPlaying to false', () => {
    useStore.setState({ isPlaying: true })
    useStore.getState().setIsPlaying(false)
    expect(useStore.getState().isPlaying).toBe(false)
  })

  it('setPlaybackPosition updates playbackPosition without changing mode', () => {
    useStore.getState().enterPlayback('pos1')
    useStore.getState().setPlaybackPosition('pos2')
    expect(useStore.getState().playbackPosition).toBe('pos2')
    expect(useStore.getState().mode).toBe('playback')
  })
})
