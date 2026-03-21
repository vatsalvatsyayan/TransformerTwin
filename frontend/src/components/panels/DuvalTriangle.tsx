// SVG Duval Triangle ternary diagram — skeleton

import { memo } from 'react'
import { useStore } from '../../store'
import { ternaryToCartesian, TRIANGLE_WIDTH, TRIANGLE_HEIGHT } from '../../lib/duvalGeometry'
import { DUVAL_ZONE_COLORS } from '../../lib/constants'

const PADDING = 20

export const DuvalTriangle = memo(function DuvalTriangle() {
  const analysis = useStore((s) => s.analysis)
  const duval = analysis?.duval

  const viewW = TRIANGLE_WIDTH + PADDING * 2
  const viewH = TRIANGLE_HEIGHT + PADDING * 2

  // Triangle vertices in SVG coords (padded)
  const bl = { x: PADDING, y: viewH - PADDING }
  const br = { x: viewW - PADDING, y: viewH - PADDING }
  const top = { x: viewW / 2, y: PADDING }

  // Current point
  let pointX: number | null = null
  let pointY: number | null = null
  if (duval && duval.zone !== 'NONE') {
    const cart = ternaryToCartesian({
      ch4: duval.pct_ch4 / 100,
      c2h4: duval.pct_c2h4 / 100,
      c2h2: duval.pct_c2h2 / 100,
    })
    pointX = cart.x + PADDING
    pointY = cart.y + PADDING
  }

  const zone = duval?.zone ?? 'NONE'
  const zoneColor = DUVAL_ZONE_COLORS[zone] ?? DUVAL_ZONE_COLORS.NONE

  return (
    <div className="p-4">
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="w-full max-w-sm mx-auto"
      >
        {/* Triangle boundary */}
        <polygon
          points={`${bl.x},${bl.y} ${br.x},${br.y} ${top.x},${top.y}`}
          fill="#1e2133"
          stroke="#3d4168"
          strokeWidth={1}
        />

        {/* Axis labels */}
        <text x={bl.x - 8} y={bl.y + 14} fill="#64748b" fontSize={9} textAnchor="middle">C₂H₂</text>
        <text x={br.x + 4} y={br.y + 14} fill="#64748b" fontSize={9} textAnchor="middle">CH₄</text>
        <text x={top.x} y={top.y - 6} fill="#64748b" fontSize={9} textAnchor="middle">C₂H₄</text>

        {/* Current point */}
        {pointX !== null && pointY !== null && (
          <circle cx={pointX} cy={pointY} r={5} fill={zoneColor} stroke="#fff" strokeWidth={1} />
        )}
      </svg>

      {/* Zone label */}
      <div className="text-center mt-2 text-xs">
        <span className="font-medium" style={{ color: zoneColor }}>
          {duval?.zone_label ?? 'No data'}
        </span>
      </div>
    </div>
  )
})
