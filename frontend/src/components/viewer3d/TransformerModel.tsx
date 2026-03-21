// All transformer meshes grouped

import { memo } from 'react'
import { Tank } from './parts/Tank'
import { Conservator } from './parts/Conservator'
import { HVBushing } from './parts/HVBushing'
import { LVBushing } from './parts/LVBushing'
import { RadiatorBank } from './parts/RadiatorBank'
import { FanUnit } from './parts/FanUnit'
import { OilPump } from './parts/OilPump'
import { TapChanger } from './parts/TapChanger'
import { BuchholzRelay } from './parts/BuchholzRelay'

export const TransformerModel = memo(function TransformerModel() {
  return (
    <group>
      <Tank />
      <Conservator />

      {/* HV Bushings — top, 3 positions */}
      <HVBushing position={[-0.5, 1.8, 0]} />
      <HVBushing position={[0,    1.8, 0]} />
      <HVBushing position={[0.5,  1.8, 0]} />

      {/* LV Bushings — rear, 3 positions */}
      <LVBushing position={[-0.4, 1.6, -0.7]} />
      <LVBushing position={[0,    1.6, -0.7]} />
      <LVBushing position={[0.4,  1.6, -0.7]} />

      {/* Radiator banks — left and right sides */}
      <RadiatorBank position={[-1.1, 0, 0]} />
      <RadiatorBank position={[ 1.1, 0, 0]} />

      {/* Fan units — attached to radiator banks */}
      <FanUnit position={[-1.15, -0.5, 0]} sensorId="FAN_BANK_1" />
      <FanUnit position={[ 1.15, -0.5, 0]} sensorId="FAN_BANK_2" />

      <OilPump />
      <TapChanger />
      <BuchholzRelay />
    </group>
  )
})
