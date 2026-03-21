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

// Tank body: [2, 2.8, 1.1] centred at Y=0 → top lid at Y=1.4

export const TransformerModel = memo(function TransformerModel() {
  return (
    <group>
      {/* === Steel skid cradle (two longitudinal I-beams) === */}
      {([-0.36, 0.36] as const).map((z) => (
        <mesh key={z} position={[0, -1.52, z]} castShadow receiveShadow>
          <boxGeometry args={[2.35, 0.12, 0.18]} />
          <meshStandardMaterial color="#505050" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}

      {/* Cross-members under skid */}
      {([-0.75, 0, 0.75] as const).map((x) => (
        <mesh key={x} position={[x, -1.6, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.1, 0.08, 0.9]} />
          <meshStandardMaterial color="#454545" metalness={0.7} roughness={0.35} />
        </mesh>
      ))}

      {/* === Main tank body === */}
      <Tank />

      {/* === Conservator, support pipe, breather === */}
      <Conservator />

      {/* === HV Bushings — top of tank lid, shaft centre at Y=2.05 === */}
      <HVBushing position={[-0.5, 2.05, 0.1]} />
      <HVBushing position={[0,    2.05, 0.1]} />
      <HVBushing position={[0.5,  2.05, 0.1]} />

      {/* === LV Bushings — rear top of tank === */}
      <LVBushing position={[-0.35, 1.82, -0.55]} />
      <LVBushing position={[0,     1.82, -0.55]} />
      <LVBushing position={[0.35,  1.82, -0.55]} />

      {/* === Radiator banks — left and right === */}
      <RadiatorBank position={[-1.1, 0, 0]} />
      <RadiatorBank position={[ 1.1, 0, 0]} />

      {/* === Fan units — lower radiator banks === */}
      <FanUnit position={[-1.12, -0.6, 0]} sensorId="FAN_BANK_1" />
      <FanUnit position={[ 1.12, -0.6, 0]} sensorId="FAN_BANK_2" />

      {/* === Oil circulation pump — front-right === */}
      <OilPump />

      {/* === On-Load Tap Changer — left side === */}
      <TapChanger />

      {/* === Buchholz relay — on conservator pipe === */}
      <BuchholzRelay />

      {/* === Pressure relief vent pipe (top of tank) === */}
      <mesh position={[-0.7, 1.65, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.5, 8]} />
        <meshStandardMaterial color="#3a4a5a" metalness={0.55} roughness={0.45} />
      </mesh>

      {/* === Oil drain valve (front-bottom) === */}
      <mesh position={[0.5, -1.3, 0.58]} castShadow>
        <boxGeometry args={[0.12, 0.1, 0.08]} />
        <meshStandardMaterial color="#2c3a48" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* === Control cabinet (right side, front) === */}
      <mesh position={[0.95, -0.85, 0.58]} castShadow>
        <boxGeometry args={[0.28, 0.55, 0.1]} />
        <meshStandardMaterial color="#2a3a2a" metalness={0.35} roughness={0.6} />
      </mesh>
    </group>
  )
})
