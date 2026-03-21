// Duval Triangle ternary math, zone polygon definitions, and SVG rendering helpers.
//
// Coordinate convention (IEC 60599 / DUVAL_TRIANGLE_VERTICES.md):
//   Bottom-left vertex  →  %CH4  = 100  →  normalized (0.0, 0.0)
//   Bottom-right vertex →  %C2H4 = 100  →  normalized (1.0, 0.0)
//   Top vertex          →  %C2H2 = 100  →  normalized (0.5, 0.866)
//
// Ternary → normalized Cartesian:
//   x = pctC2H4/100 + pctC2H2/100 * 0.5
//   y = pctC2H2/100 * (√3/2)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TernaryPoint {
  /** CH₄ fraction 0–1 */
  ch4: number
  /** C₂H₄ fraction 0–1 */
  c2h4: number
  /** C₂H₂ fraction 0–1 */
  c2h2: number
}

export interface CartesianPoint {
  x: number
  y: number
}

export interface DuvalZonePolygon {
  zone: string
  label: string
  color: string
  /** Normalized Cartesian vertices [x, y] each in [0, 1] */
  vertices: [number, number][]
}

// ---------------------------------------------------------------------------
// Triangle dimensions (SVG pixel space before padding)
// ---------------------------------------------------------------------------

export const TRIANGLE_WIDTH = 500
export const TRIANGLE_HEIGHT = TRIANGLE_WIDTH * (Math.sqrt(3) / 2)  // ≈ 433

/** Padding around the triangle in SVG pixels */
export const TRIANGLE_PADDING = 40

// ---------------------------------------------------------------------------
// Coordinate transforms
// ---------------------------------------------------------------------------

/**
 * Convert ternary fractions (0–1 each) to normalized Cartesian (0–1).
 *
 * Formula (per IEC 60599 / DUVAL_TRIANGLE_VERTICES.md):
 *   x = c2h4 + c2h2 * 0.5
 *   y = c2h2 * (√3/2)
 */
export function ternaryToNormalized(point: TernaryPoint): CartesianPoint {
  const { c2h4, c2h2 } = point
  return {
    x: c2h4 + c2h2 * 0.5,
    y: c2h2 * (Math.sqrt(3) / 2),
  }
}

/**
 * Convert ternary fractions (0–1) to SVG pixel coordinates with padding.
 *
 * @param point  - Ternary fractions (0–1).
 * @param width  - Usable triangle width in pixels (default TRIANGLE_WIDTH).
 * @param height - Usable triangle height in pixels (default TRIANGLE_HEIGHT).
 * @param pad    - Padding in pixels (default TRIANGLE_PADDING).
 */
export function ternaryToCartesian(
  point: TernaryPoint,
  width: number = TRIANGLE_WIDTH,
  height: number = TRIANGLE_HEIGHT,
  pad: number = TRIANGLE_PADDING,
): CartesianPoint {
  const norm = ternaryToNormalized(point)
  return normalizedToSVG(norm.x, norm.y, width, height, pad)
}

/**
 * Map normalized [0, 1] coordinates to SVG pixel space with padding.
 * Flips Y so y=0 maps to the bottom of the SVG canvas.
 */
export function normalizedToSVG(
  nx: number,
  ny: number,
  width: number = TRIANGLE_WIDTH,
  height: number = TRIANGLE_HEIGHT,
  pad: number = TRIANGLE_PADDING,
): CartesianPoint {
  const usableW = width - 2 * pad
  const usableH = height - 2 * pad
  return {
    x: pad + nx * usableW,
    y: height - pad - ny * usableH,  // Flip Y: ny=0 → bottom, ny=1 → top
  }
}

/**
 * Convert an array of normalized [x, y] vertices to an SVG points string.
 */
export function polygonToSVGPoints(
  vertices: [number, number][],
  width: number = TRIANGLE_WIDTH,
  height: number = TRIANGLE_HEIGHT,
  pad: number = TRIANGLE_PADDING,
): string {
  return vertices
    .map(([x, y]) => {
      const pt = normalizedToSVG(x, y, width, height, pad)
      return `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`
    })
    .join(' ')
}

/**
 * Return the SVG points string for the outer equilateral triangle.
 */
export function getTriangleSVGPoints(
  width: number = TRIANGLE_WIDTH,
  height: number = TRIANGLE_HEIGHT,
  pad: number = TRIANGLE_PADDING,
): string {
  // Bottom-left (CH4=100%), bottom-right (C2H4=100%), top (C2H2=100%)
  return polygonToSVGPoints(
    [[0.0, 0.0], [1.0, 0.0], [0.5, Math.sqrt(3) / 2]],
    width, height, pad,
  )
}

// ---------------------------------------------------------------------------
// Zone colors and labels
// ---------------------------------------------------------------------------

export const DUVAL_ZONE_COLORS: Record<string, string> = {
  PD:   '#9333ea',  // purple  — Partial Discharge
  T1:   '#f59e0b',  // amber   — Thermal < 300°C
  T2:   '#f97316',  // orange  — Thermal 300–700°C
  T3:   '#ef4444',  // red     — Thermal > 700°C
  D1:   '#3b82f6',  // blue    — Low Energy Discharge
  D2:   '#06b6d4',  // cyan    — High Energy Discharge
  DT:   '#8b5cf6',  // violet  — Discharge + Thermal
  NONE: '#374151',  // gray    — No data
}

export const DUVAL_ZONE_LABELS: Record<string, string> = {
  PD:   'Partial Discharge',
  T1:   'Thermal < 300°C',
  T2:   'Thermal 300–700°C',
  T3:   'Thermal > 700°C',
  D1:   'Low Energy Discharge',
  D2:   'High Energy Discharge',
  DT:   'Discharge + Thermal',
  NONE: 'Insufficient Data',
}

// ---------------------------------------------------------------------------
// Zone polygons — normalized [0, 1] Cartesian vertices
// (from docs/DUVAL_TRIANGLE_VERTICES.md Section 4)
// ---------------------------------------------------------------------------

export const DUVAL_ZONE_POLYGONS: DuvalZonePolygon[] = [
  {
    zone: 'PD',
    label: 'Partial Discharge',
    color: '#9333ea',
    vertices: [
      [0.000, 0.000],
      [0.040, 0.000],
      [0.041, 0.001],
      [0.001, 0.001],
    ],
  },
  {
    zone: 'T1',
    label: 'Thermal < 300°C',
    color: '#f59e0b',
    vertices: [
      [0.040, 0.000],
      [0.200, 0.000],
      [0.265, 0.113],
      [0.105, 0.113],
      [0.041, 0.001],
    ],
  },
  {
    zone: 'T2',
    label: 'Thermal 300–700°C',
    color: '#f97316',
    vertices: [
      [0.200, 0.000],
      [0.500, 0.000],
      [0.565, 0.113],
      [0.265, 0.113],
    ],
  },
  {
    zone: 'T3',
    label: 'Thermal > 700°C',
    color: '#ef4444',
    vertices: [
      [0.500, 0.000],
      [1.000, 0.000],
      [0.935, 0.113],
      [0.565, 0.113],
    ],
  },
  {
    zone: 'D1',
    label: 'Low Energy Discharge',
    color: '#3b82f6',
    vertices: [
      [0.105, 0.113],
      [0.265, 0.113],
      [0.565, 0.113],
      [0.500, 0.251],
      [0.445, 0.251],
      [0.145, 0.251],
    ],
  },
  {
    zone: 'D2',
    label: 'High Energy Discharge',
    color: '#06b6d4',
    vertices: [
      [0.565, 0.113],
      [0.935, 0.113],
      [0.855, 0.251],
      [0.500, 0.251],
    ],
  },
  {
    zone: 'DT',
    label: 'Discharge + Thermal',
    color: '#8b5cf6',
    vertices: [
      [0.145, 0.251],
      [0.445, 0.251],
      [0.500, 0.251],
      [0.855, 0.251],
      [0.500, 0.866],
    ],
  },
]

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Point-in-polygon test using the ray casting algorithm.
 */
export function pointInPolygon(point: CartesianPoint, polygon: CartesianPoint[]): boolean {
  let inside = false
  const { x, y } = point
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}
