// 55/45 split layout: 3D viewer (left) + panel tabs (right)

import { memo } from 'react'
import { TransformerScene } from '../viewer3d/TransformerScene'
import { TabContainer } from '../panels/TabContainer'

export const MainLayout = memo(function MainLayout() {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left panel — 55% — 3D transformer viewer */}
      <div className="w-[55%] flex-shrink-0 relative">
        <TransformerScene />
      </div>

      {/* Right panel — 45% — data tabs */}
      <div className="flex-1 overflow-hidden border-l border-[#2d3148]">
        <TabContainer />
      </div>
    </div>
  )
})
