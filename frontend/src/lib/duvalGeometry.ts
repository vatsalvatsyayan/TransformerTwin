// Duval Triangle ternary math, zone polygon definitions, and point-in-polygon test

/** Convert ternary (a, b, c) percentages to Cartesian (x, y) for an equilateral triangle.
 *
 * The triangle occupies a 300×260 SVG coordinate space:
 *  - Bottom-left vertex: C₂H₂ = 100%
 *  - Bottom-right vertex: CH₄ = 100%
 *  - Top vertex: C₂H₄ = 100%
 */
export interface TernaryPoint {
  /** CH₄ fraction (0–1) */
  ch4: number
  /** C₂H₄ fraction (0–1) */
  c2h4: number
  /** C₂H₂ fraction (0–1) */
  c2h2: number
}

export interface CartesianPoint {
  x: number
  y: number
}

/** Width and height of the equilateral triangle SVG space */
export const TRIANGLE_WIDTH = 300
export const TRIANGLE_HEIGHT = Math.sqrt(3) / 2 * TRIANGLE_WIDTH  // ≈ 259.8

/**
 * Convert normalized ternary coordinates to SVG Cartesian coordinates.
 *
 * Convention (IEC 60599 Duval Triangle):
 *  - Bottom axis (left → right): %C₂H₂ (0 → 100)
 *  - Right axis: %CH₄ (0 → 100, read bottom-right to top)
 *  - Left axis: %C₂H₄ (0 → 100, read bottom-left to top)
 */
export function ternaryToCartesian(point: TernaryPoint): CartesianPoint {
  const { ch4, c2h4, c2h2 } = point
  // Using standard ternary triangle layout
  const x = (c2h2 + ch4 / 2) * TRIANGLE_WIDTH
  const y = TRIANGLE_HEIGHT - c2h4 * TRIANGLE_HEIGHT
  return { x, y }
}

/** Return the SVG path string for the outer triangle boundary */
export function getTrianglePath(): string {
  const bl: CartesianPoint = { x: 0, y: TRIANGLE_HEIGHT }
  const br: CartesianPoint = { x: TRIANGLE_WIDTH, y: TRIANGLE_HEIGHT }
  const top: CartesianPoint = { x: TRIANGLE_WIDTH / 2, y: 0 }
  return `M ${bl.x} ${bl.y} L ${br.x} ${br.y} L ${top.x} ${top.y} Z`
}

/**
 * Point-in-polygon test using ray casting algorithm.
 *
 * @param point - The point to test.
 * @param polygon - Array of vertices defining the polygon.
 * @returns True if the point is inside the polygon.
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
