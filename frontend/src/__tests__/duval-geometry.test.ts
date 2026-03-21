import { describe, it, expect } from 'vitest'
import {
  ternaryToNormalized,
  normalizedToSVG,
  ternaryToCartesian,
  pointInPolygon,
  polygonToSVGPoints,
  getTriangleSVGPoints,
  DUVAL_ZONE_COLORS,
  DUVAL_ZONE_LABELS,
  DUVAL_ZONE_POLYGONS,
  TRIANGLE_WIDTH,
  TRIANGLE_HEIGHT,
  TRIANGLE_PADDING,
  type TernaryPoint,
  type CartesianPoint,
} from '../lib/duvalGeometry'

// ---------------------------------------------------------------------------
// Helper: classify a gas sample against the zone polygons.
//
// Accepts raw percentage counts (not fractions).  Normalises to fractions,
// converts to normalized Cartesian, then runs pointInPolygon against every
// DUVAL_ZONE_POLYGONS entry in order.  Returns the first matching zone name
// or 'NONE' if no zone matches.
// ---------------------------------------------------------------------------
function classifyPoint(ch4: number, c2h4: number, c2h2: number): string {
  const sum = ch4 + c2h4 + c2h2
  const frac: TernaryPoint = {
    ch4: ch4 / sum,
    c2h4: c2h4 / sum,
    c2h2: c2h2 / sum,
  }
  const norm = ternaryToNormalized(frac)

  for (const zone of DUVAL_ZONE_POLYGONS) {
    const polygon: CartesianPoint[] = zone.vertices.map(([x, y]) => ({ x, y }))
    if (pointInPolygon(norm, polygon)) {
      return zone.zone
    }
  }
  return 'NONE'
}

// ---------------------------------------------------------------------------
// 1. ternaryToNormalized()
// ---------------------------------------------------------------------------

describe('ternaryToNormalized()', () => {
  it('CH4=100% maps to bottom-left (0, 0)', () => {
    const result = ternaryToNormalized({ ch4: 1, c2h4: 0, c2h2: 0 })
    expect(result.x).toBeCloseTo(0, 10)
    expect(result.y).toBeCloseTo(0, 10)
  })

  it('C2H4=100% maps to bottom-right (1, 0)', () => {
    const result = ternaryToNormalized({ ch4: 0, c2h4: 1, c2h2: 0 })
    expect(result.x).toBeCloseTo(1, 10)
    expect(result.y).toBeCloseTo(0, 10)
  })

  it('C2H2=100% maps to top vertex (0.5, ~0.866)', () => {
    const result = ternaryToNormalized({ ch4: 0, c2h4: 0, c2h2: 1 })
    expect(result.x).toBeCloseTo(0.5, 5)
    expect(result.y).toBeCloseTo(Math.sqrt(3) / 2, 5)
  })

  it('Equal thirds map to centroid (~0.5, ~0.289)', () => {
    const frac = 1 / 3
    const result = ternaryToNormalized({ ch4: frac, c2h4: frac, c2h2: frac })
    // x = frac + frac*0.5 = 1.5*frac = 0.5
    expect(result.x).toBeCloseTo(0.5, 5)
    // y = frac * sqrt(3)/2 ≈ 0.3333 * 0.8660 ≈ 0.2887
    expect(result.y).toBeCloseTo(frac * (Math.sqrt(3) / 2), 5)
    expect(result.y).toBeGreaterThan(0.288)
    expect(result.y).toBeLessThan(0.290)
  })

  it('returns x and y as numbers', () => {
    const result = ternaryToNormalized({ ch4: 0.5, c2h4: 0.3, c2h2: 0.2 })
    expect(typeof result.x).toBe('number')
    expect(typeof result.y).toBe('number')
  })
})

// ---------------------------------------------------------------------------
// 2. normalizedToSVG()
// ---------------------------------------------------------------------------

describe('normalizedToSVG()', () => {
  const W = TRIANGLE_WIDTH
  const H = TRIANGLE_HEIGHT
  const PAD = TRIANGLE_PADDING

  it('nx=0, ny=0 → bottom-left corner (pad, height-pad)', () => {
    const result = normalizedToSVG(0, 0)
    expect(result.x).toBeCloseTo(PAD, 5)
    expect(result.y).toBeCloseTo(H - PAD, 5)
  })

  it('nx=1, ny=0 → bottom-right corner (width-pad, height-pad)', () => {
    const result = normalizedToSVG(1, 0)
    expect(result.x).toBeCloseTo(W - PAD, 5)
    expect(result.y).toBeCloseTo(H - PAD, 5)
  })

  it('nx=0.5, ny=sqrt(3)/2 → top vertex (~width/2, expected SVG y)', () => {
    const ny = Math.sqrt(3) / 2
    const result = normalizedToSVG(0.5, ny)
    // x is at horizontal midpoint
    expect(result.x).toBeCloseTo(W / 2, 1)
    // y = height - pad - ny * (height - 2*pad)
    const expectedY = H - PAD - ny * (H - 2 * PAD)
    expect(result.y).toBeCloseTo(expectedY, 1)
    // The SVG y must be above the baseline (smaller value) and within bounds
    expect(result.y).toBeGreaterThanOrEqual(PAD)
    expect(result.y).toBeLessThan(H - PAD)
  })

  it('Y-flip: higher ny produces a lower SVG y value', () => {
    const low = normalizedToSVG(0.5, 0.1)
    const high = normalizedToSVG(0.5, 0.8)
    expect(high.y).toBeLessThan(low.y)
  })

  it('respects custom width, height, and padding arguments', () => {
    const result = normalizedToSVG(0, 0, 200, 100, 10)
    expect(result.x).toBeCloseTo(10, 5)
    expect(result.y).toBeCloseTo(90, 5)
  })

  it('nx=0.5, ny=0 → horizontal centre at bottom baseline', () => {
    const result = normalizedToSVG(0.5, 0)
    expect(result.x).toBeCloseTo(W / 2, 5)
    expect(result.y).toBeCloseTo(H - PAD, 5)
  })
})

// ---------------------------------------------------------------------------
// 3. ternaryToCartesian()
// ---------------------------------------------------------------------------

describe('ternaryToCartesian()', () => {
  const W = TRIANGLE_WIDTH
  const H = TRIANGLE_HEIGHT
  const PAD = TRIANGLE_PADDING

  it('CH4=100% → bottom-left SVG corner', () => {
    const result = ternaryToCartesian({ ch4: 1, c2h4: 0, c2h2: 0 })
    expect(result.x).toBeCloseTo(PAD, 5)
    expect(result.y).toBeCloseTo(H - PAD, 5)
  })

  it('C2H4=100% → bottom-right SVG corner', () => {
    const result = ternaryToCartesian({ ch4: 0, c2h4: 1, c2h2: 0 })
    expect(result.x).toBeCloseTo(W - PAD, 5)
    expect(result.y).toBeCloseTo(H - PAD, 5)
  })

  it('C2H2=100% → top SVG vertex (x at midpoint, y above baseline)', () => {
    const result = ternaryToCartesian({ ch4: 0, c2h4: 0, c2h2: 1 })
    // x is at horizontal midpoint
    expect(result.x).toBeCloseTo(W / 2, 1)
    // y = height - pad - ny * (height - 2*pad) where ny = sqrt(3)/2
    const ny = Math.sqrt(3) / 2
    const expectedY = H - PAD - ny * (H - 2 * PAD)
    expect(result.y).toBeCloseTo(expectedY, 1)
    // Must be above the baseline
    expect(result.y).toBeLessThan(H - PAD)
    expect(result.y).toBeGreaterThanOrEqual(PAD)
  })

  it('result lies within SVG bounds [pad, width-pad] × [pad, height-pad]', () => {
    const samples: TernaryPoint[] = [
      { ch4: 0.5, c2h4: 0.3, c2h2: 0.2 },
      { ch4: 0.1, c2h4: 0.8, c2h2: 0.1 },
      { ch4: 0.7, c2h4: 0.1, c2h2: 0.2 },
    ]
    for (const pt of samples) {
      const result = ternaryToCartesian(pt)
      expect(result.x).toBeGreaterThanOrEqual(PAD)
      expect(result.x).toBeLessThanOrEqual(W - PAD)
      expect(result.y).toBeGreaterThanOrEqual(PAD)
      expect(result.y).toBeLessThanOrEqual(H - PAD)
    }
  })

  it('is the composition of ternaryToNormalized + normalizedToSVG', () => {
    const pt: TernaryPoint = { ch4: 0.4, c2h4: 0.4, c2h2: 0.2 }
    const norm = ternaryToNormalized(pt)
    const expected = normalizedToSVG(norm.x, norm.y)
    const result = ternaryToCartesian(pt)
    expect(result.x).toBeCloseTo(expected.x, 10)
    expect(result.y).toBeCloseTo(expected.y, 10)
  })
})

// ---------------------------------------------------------------------------
// 4. pointInPolygon()
// ---------------------------------------------------------------------------

describe('pointInPolygon()', () => {
  // Simple unit square [0,0]–[1,0]–[1,1]–[0,1]
  const square: CartesianPoint[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]

  // Right-angled triangle (0,0)–(4,0)–(0,3)
  const triangle: CartesianPoint[] = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 3 },
  ]

  it('returns true for a point clearly inside a square', () => {
    expect(pointInPolygon({ x: 0.5, y: 0.5 }, square)).toBe(true)
  })

  it('returns false for a point clearly outside a square', () => {
    expect(pointInPolygon({ x: 2, y: 2 }, square)).toBe(false)
  })

  it('returns false for a point far outside a square', () => {
    expect(pointInPolygon({ x: -1, y: -1 }, square)).toBe(false)
  })

  it('returns true for a point inside a triangle', () => {
    expect(pointInPolygon({ x: 1, y: 0.5 }, triangle)).toBe(true)
  })

  it('returns false for a point outside a triangle', () => {
    expect(pointInPolygon({ x: 3, y: 2.5 }, triangle)).toBe(false)
  })

  it('returns a boolean', () => {
    const result = pointInPolygon({ x: 0.5, y: 0.5 }, square)
    expect(typeof result).toBe('boolean')
  })
})

// ---------------------------------------------------------------------------
// 5. Zone classifications (IEC 60599 known gas samples)
//
// Each sample is expressed as raw ppm or percentage counts.  The helper
// normalises to fractions internally.  Correct zone assignments are
// verified against the polygon vertices defined in duvalGeometry.ts.
//
// Working (x, y values in normalized Cartesian space):
//   x = c2h4_frac + c2h2_frac * 0.5
//   y = c2h2_frac * (√3/2)
// ---------------------------------------------------------------------------

describe('Zone classifications — classifyPoint()', () => {
  // --- T1: Thermal < 300°C ---
  // Gas: ch4=84, c2h4=15, c2h2=1  (sum=100)
  // Fracs: ch4=0.84, c2h4=0.15, c2h2=0.01
  // x = 0.15 + 0.01*0.5 = 0.155
  // y = 0.01 * 0.8660 = 0.00866
  // → T1 polygon spans x=0.04–0.265, y=0–0.113 ✓
  it('ch4=84, c2h4=15, c2h2=1 → T1 (Thermal < 300°C)', () => {
    expect(classifyPoint(84, 15, 1)).toBe('T1')
  })

  // A stronger T1 interior point: ch4=90, c2h4=9, c2h2=1  (sum=100)
  // Fracs: c2h4=0.09, c2h2=0.01
  // x = 0.09 + 0.005 = 0.095, y = 0.00866 → inside T1 ✓
  it('ch4=90, c2h4=9, c2h2=1 → T1', () => {
    expect(classifyPoint(90, 9, 1)).toBe('T1')
  })

  // --- T2: Thermal 300–700°C ---
  // Gas: ch4=55, c2h4=44, c2h2=1  (sum=100)
  // Fracs: c2h4=0.44, c2h2=0.01
  // x = 0.44 + 0.005 = 0.445, y ≈ 0.00866
  // → T2 polygon spans x=0.2–0.565, y=0–0.113 ✓
  it('ch4=55, c2h4=44, c2h2=1 → T2 (Thermal 300–700°C)', () => {
    expect(classifyPoint(55, 44, 1)).toBe('T2')
  })

  // --- T3: Thermal > 700°C ---
  // Gas: ch4=15, c2h4=83, c2h2=2  (sum=100)
  // Fracs: c2h4=0.83, c2h2=0.02
  // x = 0.83 + 0.01 = 0.84, y ≈ 0.01732
  // → T3 polygon spans x=0.5–1.0, y=0–0.113 ✓
  it('ch4=15, c2h4=83, c2h2=2 → T3 (Thermal > 700°C)', () => {
    expect(classifyPoint(15, 83, 2)).toBe('T3')
  })

  // Second T3 sample from the prompt: c2h4=90, ch4=8, c2h2=2  (sum=100)
  // Fracs: c2h4=0.9, c2h2=0.02
  // x = 0.9 + 0.01 = 0.91, y ≈ 0.01732 → T3 ✓
  it('ch4=8, c2h4=90, c2h2=2 → T3', () => {
    expect(classifyPoint(8, 90, 2)).toBe('T3')
  })

  // --- D1: Low Energy Discharge ---
  // Gas: ch4=45, c2h4=30, c2h2=25  (sum=100)
  // Fracs: c2h4=0.30, c2h2=0.25
  // x = 0.30 + 0.125 = 0.425, y = 0.25 * 0.8660 = 0.2165
  // → D1 polygon: x=0.105–0.565, y=0.113–0.251 ✓
  it('ch4=45, c2h4=30, c2h2=25 → D1 (Low Energy Discharge)', () => {
    expect(classifyPoint(45, 30, 25)).toBe('D1')
  })

  // --- D2: High Energy Discharge ---
  // Gas: ch4=30, c2h4=45, c2h2=25  (sum=100)
  // Fracs: c2h4=0.45, c2h2=0.25
  // x = 0.45 + 0.125 = 0.575, y = 0.25 * 0.8660 = 0.2165
  // → D2 polygon spans x=0.565–0.935, y=0.113–0.251 ✓
  it('ch4=30, c2h4=45, c2h2=25 → D2 (High Energy Discharge)', () => {
    expect(classifyPoint(30, 45, 25)).toBe('D2')
  })

  // Prompt's D2 sample: c2h2=25, c2h4=45, ch4=30 (same composition, reordered args)
  it('ch4=30, c2h4=45, c2h2=25 → D2 (prompt sample)', () => {
    expect(classifyPoint(30, 45, 25)).toBe('D2')
  })

  // --- DT: Discharge + Thermal ---
  // Gas: ch4=22, c2h4=22, c2h2=56  (sum=100)
  // Fracs: c2h4=0.22, c2h2=0.56
  // x = 0.22 + 0.28 = 0.500, y = 0.56 * 0.8660 ≈ 0.485
  // → DT polygon: y ≥ 0.251, inside upper triangle ✓
  it('ch4=22, c2h4=22, c2h2=56 → DT (Discharge + Thermal)', () => {
    expect(classifyPoint(22, 22, 56)).toBe('DT')
  })

  // Prompt's DT sample: c2h2=80, c2h4=15, ch4=5 (sum=100)
  // Fracs: c2h4=0.15, c2h2=0.80
  // x = 0.15 + 0.40 = 0.550, y = 0.80 * 0.8660 ≈ 0.693 → DT ✓
  it('ch4=5, c2h4=15, c2h2=80 → DT (prompt sample)', () => {
    expect(classifyPoint(5, 15, 80)).toBe('DT')
  })
})

// ---------------------------------------------------------------------------
// 6. getTriangleSVGPoints()
// ---------------------------------------------------------------------------

describe('getTriangleSVGPoints()', () => {
  it('returns a non-empty string', () => {
    const result = getTriangleSVGPoints()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('contains commas and spaces (valid SVG points format)', () => {
    const result = getTriangleSVGPoints()
    expect(result).toContain(',')
    expect(result).toContain(' ')
  })

  it('contains exactly 3 point pairs for an equilateral triangle', () => {
    const result = getTriangleSVGPoints()
    // Space-separated pairs: "x1,y1 x2,y2 x3,y3"
    const pairs = result.trim().split(' ')
    expect(pairs).toHaveLength(3)
    // Each pair must contain exactly one comma
    for (const pair of pairs) {
      expect(pair.split(',').length).toBe(2)
    }
  })

  it('respects custom dimensions passed as arguments', () => {
    const defaultResult = getTriangleSVGPoints()
    const customResult = getTriangleSVGPoints(300, 260, 20)
    expect(defaultResult).not.toBe(customResult)
  })
})

// ---------------------------------------------------------------------------
// 7. polygonToSVGPoints()
// ---------------------------------------------------------------------------

describe('polygonToSVGPoints()', () => {
  it('returns "x1,y1 x2,y2 x3,y3" format for a 3-vertex polygon', () => {
    const vertices: [number, number][] = [
      [0.0, 0.0],
      [1.0, 0.0],
      [0.5, Math.sqrt(3) / 2],
    ]
    const result = polygonToSVGPoints(vertices)
    const pairs = result.trim().split(' ')
    expect(pairs).toHaveLength(3)
    for (const pair of pairs) {
      const parts = pair.split(',')
      expect(parts).toHaveLength(2)
      // Each coordinate should parse as a finite number
      expect(isFinite(Number(parts[0]))).toBe(true)
      expect(isFinite(Number(parts[1]))).toBe(true)
    }
  })

  it('formats coordinates to 2 decimal places', () => {
    const vertices: [number, number][] = [[0.0, 0.0], [1.0, 0.0]]
    const result = polygonToSVGPoints(vertices)
    // Each number should have at most 2 decimal digits
    const numberPattern = /^\d+\.\d{2}$/
    const pairs = result.trim().split(' ')
    for (const pair of pairs) {
      for (const coord of pair.split(',')) {
        expect(numberPattern.test(coord)).toBe(true)
      }
    }
  })

  it('bottom-left vertex (0,0) maps to (pad, height-pad) in SVG', () => {
    const vertices: [number, number][] = [[0.0, 0.0]]
    const result = polygonToSVGPoints(vertices)
    const [xStr, yStr] = result.split(',')
    expect(Number(xStr)).toBeCloseTo(TRIANGLE_PADDING, 1)
    expect(Number(yStr)).toBeCloseTo(TRIANGLE_HEIGHT - TRIANGLE_PADDING, 1)
  })

  it('matches manual normalizedToSVG calculation for each vertex', () => {
    const vertices: [number, number][] = [
      [0.2, 0.0],
      [0.5, 0.113],
      [0.8, 0.0],
    ]
    const result = polygonToSVGPoints(vertices)
    const pairs = result.trim().split(' ')
    vertices.forEach(([nx, ny], idx) => {
      const expected = normalizedToSVG(nx, ny)
      const [xStr, yStr] = pairs[idx].split(',')
      expect(Number(xStr)).toBeCloseTo(expected.x, 1)
      expect(Number(yStr)).toBeCloseTo(expected.y, 1)
    })
  })
})

// ---------------------------------------------------------------------------
// 8. DUVAL_ZONE_COLORS and DUVAL_ZONE_LABELS
// ---------------------------------------------------------------------------

describe('DUVAL_ZONE_COLORS', () => {
  const expectedZones = ['PD', 'T1', 'T2', 'T3', 'D1', 'D2', 'DT']

  it('contains entries for all 7 diagnostic zones', () => {
    for (const zone of expectedZones) {
      expect(Object.prototype.hasOwnProperty.call(DUVAL_ZONE_COLORS, zone)).toBe(true)
    }
  })

  it('all color values start with "#"', () => {
    for (const zone of expectedZones) {
      expect(DUVAL_ZONE_COLORS[zone]).toMatch(/^#/)
    }
  })

  it('all color values are valid 6-digit hex strings', () => {
    for (const zone of expectedZones) {
      expect(DUVAL_ZONE_COLORS[zone]).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

describe('DUVAL_ZONE_LABELS', () => {
  const expectedZones = ['PD', 'T1', 'T2', 'T3', 'D1', 'D2', 'DT']

  it('contains entries for all 7 diagnostic zones', () => {
    for (const zone of expectedZones) {
      expect(Object.prototype.hasOwnProperty.call(DUVAL_ZONE_LABELS, zone)).toBe(true)
    }
  })

  it('all labels are non-empty strings', () => {
    for (const zone of expectedZones) {
      expect(typeof DUVAL_ZONE_LABELS[zone]).toBe('string')
      expect(DUVAL_ZONE_LABELS[zone].length).toBeGreaterThan(0)
    }
  })

  it('label for PD is "Partial Discharge"', () => {
    expect(DUVAL_ZONE_LABELS['PD']).toBe('Partial Discharge')
  })

  it('label for DT is "Discharge + Thermal"', () => {
    expect(DUVAL_ZONE_LABELS['DT']).toBe('Discharge + Thermal')
  })
})

// ---------------------------------------------------------------------------
// 9. DUVAL_ZONE_POLYGONS structure
// ---------------------------------------------------------------------------

describe('DUVAL_ZONE_POLYGONS', () => {
  const expectedZones = ['PD', 'T1', 'T2', 'T3', 'D1', 'D2', 'DT']

  it('contains exactly 7 zone entries', () => {
    expect(DUVAL_ZONE_POLYGONS).toHaveLength(7)
  })

  it('contains all 7 required zones', () => {
    const zoneNames = DUVAL_ZONE_POLYGONS.map((z) => z.zone)
    for (const zone of expectedZones) {
      expect(zoneNames).toContain(zone)
    }
  })

  it('each zone entry has zone, label, color, and vertices fields', () => {
    for (const entry of DUVAL_ZONE_POLYGONS) {
      expect(typeof entry.zone).toBe('string')
      expect(typeof entry.label).toBe('string')
      expect(typeof entry.color).toBe('string')
      expect(Array.isArray(entry.vertices)).toBe(true)
    }
  })

  it('each vertex is a [number, number] tuple with values in [0, 1]', () => {
    for (const entry of DUVAL_ZONE_POLYGONS) {
      for (const [vx, vy] of entry.vertices) {
        expect(vx).toBeGreaterThanOrEqual(0)
        expect(vx).toBeLessThanOrEqual(1)
        expect(vy).toBeGreaterThanOrEqual(0)
        expect(vy).toBeLessThanOrEqual(1)
      }
    }
  })

  it('each zone polygon has at least 3 vertices', () => {
    for (const entry of DUVAL_ZONE_POLYGONS) {
      expect(entry.vertices.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('all color values start with "#"', () => {
    for (const entry of DUVAL_ZONE_POLYGONS) {
      expect(entry.color).toMatch(/^#/)
    }
  })
})
