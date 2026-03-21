// SVG Duval Triangle ternary diagram with zone polygons, live point, and historical trail.
// Coordinate system: CH4→bottom-left, C2H4→bottom-right, C2H2→top (IEC 60599).

import { memo, useMemo } from 'react'
import { useStore } from '../../store'
import {
  TRIANGLE_WIDTH,
  TRIANGLE_HEIGHT,
  TRIANGLE_PADDING,
  DUVAL_ZONE_POLYGONS,
  DUVAL_ZONE_COLORS,
  DUVAL_ZONE_LABELS,
  ternaryToCartesian,
  polygonToSVGPoints,
  getTriangleSVGPoints,
} from '../../lib/duvalGeometry'

const W = TRIANGLE_WIDTH
const H = TRIANGLE_HEIGHT
const PAD = TRIANGLE_PADDING
const VIEW_W = W + PAD * 2
const VIEW_H = H + PAD * 2

export const DuvalTriangle = memo(function DuvalTriangle() {
  const analysis = useStore((s) => s.analysis)
  const duvalHistory = useStore((s) => s.duvalHistory)
  const duval = analysis?.duval

  // Outer triangle boundary points string — stable, never changes
  const outerTriangle = useMemo(
    () => getTriangleSVGPoints(W, H, PAD),
    [],
  )

  // Zone polygon SVG points strings — stable
  const zonePaths = useMemo(
    () =>
      DUVAL_ZONE_POLYGONS.map((z) => ({
        zone: z.zone,
        label: z.label,
        color: z.color,
        points: polygonToSVGPoints(z.vertices, W, H, PAD),
        // centroid in SVG coords for label placement
        centroid: (() => {
          const cx = z.vertices.reduce((s, [x]) => s + x, 0) / z.vertices.length
          const cy = z.vertices.reduce((s, [, y]) => s + y, 0) / z.vertices.length
          return {
            x: PAD + cx * (W - 2 * PAD),
            y: H - PAD - cy * (H - 2 * PAD),
          }
        })(),
      })),
    [],
  )

  // Live point in SVG coordinates
  const livePoint = useMemo(() => {
    if (!duval || duval.zone === 'NONE') return null
    return ternaryToCartesian(
      { ch4: duval.pct_ch4 / 100, c2h4: duval.pct_c2h4 / 100, c2h2: duval.pct_c2h2 / 100 },
      W, H, PAD,
    )
  }, [duval])

  // Historical trail in SVG coordinates
  const trailPoints = useMemo(
    () =>
      duvalHistory.map((d) =>
        ternaryToCartesian(
          { ch4: d.pct_ch4 / 100, c2h4: d.pct_c2h4 / 100, c2h2: d.pct_c2h2 / 100 },
          W, H, PAD,
        ),
      ),
    [duvalHistory],
  )

  const zone = duval?.zone ?? 'NONE'
  const zoneColor = DUVAL_ZONE_COLORS[zone] ?? DUVAL_ZONE_COLORS.NONE
  const zoneLabel = DUVAL_ZONE_LABELS[zone] ?? 'No data'

  // Vertex positions for axis labels
  const blPt = ternaryToCartesian({ ch4: 1, c2h4: 0, c2h2: 0 }, W, H, PAD)  // CH4 vertex
  const brPt = ternaryToCartesian({ ch4: 0, c2h4: 1, c2h2: 0 }, W, H, PAD)  // C2H4 vertex
  const topPt = ternaryToCartesian({ ch4: 0, c2h4: 0, c2h2: 1 }, W, H, PAD) // C2H2 vertex

  return (
    <div className="p-2">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full max-w-md mx-auto"
        aria-label="Duval Triangle DGA Classification"
      >
        {/* Triangle fill */}
        <polygon
          points={outerTriangle}
          fill="#0f1117"
          stroke="#374151"
          strokeWidth={1}
        />

        {/* Zone polygons at 45% opacity */}
        {zonePaths.map(({ zone: z, label, color, points }) => (
          <polygon
            key={z}
            points={points}
            fill={color}
            fillOpacity={0.45}
            stroke={color}
            strokeOpacity={0.65}
            strokeWidth={0.5}
          >
            <title>{label}</title>
          </polygon>
        ))}

        {/* Zone abbreviation labels at polygon centroids */}
        {zonePaths.map(({ zone: z, color, centroid }) => (
          <text
            key={z}
            x={centroid.x}
            y={centroid.y}
            fill={color}
            fontSize={11}
            fontWeight="700"
            textAnchor="middle"
            dominantBaseline="middle"
            opacity={0.9}
            pointerEvents="none"
          >
            {z}
          </text>
        ))}

        {/* Historical trail — fading dots oldest → newest */}
        {trailPoints.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={2.5}
            fill="#ffffff"
            opacity={(i + 1) / trailPoints.length * 0.55}
          />
        ))}

        {/* Live point — white dot with zone-colored ring */}
        {livePoint && (
          <>
            <circle cx={livePoint.x} cy={livePoint.y} r={8} fill="none" stroke={zoneColor} strokeWidth={2} opacity={0.85} />
            <circle cx={livePoint.x} cy={livePoint.y} r={4} fill="#ffffff" />
          </>
        )}

        {/* Axis labels */}
        <text x={blPt.x} y={blPt.y + 16} fill="#94a3b8" fontSize={10} textAnchor="middle">%CH₄</text>
        <text x={brPt.x} y={brPt.y + 16} fill="#94a3b8" fontSize={10} textAnchor="middle">%C₂H₄</text>
        <text x={topPt.x} y={topPt.y - 10} fill="#94a3b8" fontSize={10} textAnchor="middle">%C₂H₂</text>
      </svg>

      {/* Current zone status */}
      <div className="flex items-center justify-between mt-2 px-1 text-xs">
        <span className="text-slate-500">Current Zone</span>
        <span className="font-semibold" style={{ color: zoneColor }}>
          {zone !== 'NONE' ? `${zone} — ${zoneLabel}` : '—'}
        </span>
      </div>

      {/* Gas percentages */}
      {duval && duval.zone !== 'NONE' && (
        <div className="flex gap-4 mt-1 px-1 text-[10px] text-slate-500">
          <span>CH₄ {duval.pct_ch4.toFixed(1)}%</span>
          <span>C₂H₄ {duval.pct_c2h4.toFixed(1)}%</span>
          <span>C₂H₂ {duval.pct_c2h2.toFixed(1)}%</span>
        </div>
      )}
    </div>
  )
})
