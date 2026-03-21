// Part identity and metadata for 3D viewer interactivity

import type { HealthComponentKey } from './health'
import type { SensorId } from './sensors'

export type PartId =
  | 'tank'
  | 'conservator'
  | 'hv_bushing'
  | 'lv_bushing'
  | 'radiator'
  | 'fan_1'
  | 'fan_2'
  | 'oil_pump'
  | 'tap_changer'
  | 'buchholz_relay'

export interface PartMeta {
  label: string
  description: string
  /** Health component this part is scored under (undefined = no health component) */
  healthKey?: HealthComponentKey
  sensorIds: SensorId[]
}

export const PART_META: Record<PartId, PartMeta> = {
  tank: {
    label: 'Main Tank',
    description:
      'Steel enclosure housing the transformer core, windings, and insulating oil. The primary thermal mass of the system.',
    healthKey: 'oil_temp',
    sensorIds: ['TOP_OIL_TEMP', 'BOT_OIL_TEMP'],
  },
  conservator: {
    label: 'Conservator Tank',
    description:
      'Oil expansion vessel mounted above the main tank. Accommodates thermal expansion and houses the silica gel breather to prevent moisture ingress.',
    healthKey: 'oil_quality',
    sensorIds: ['OIL_MOISTURE', 'OIL_DIELECTRIC'],
  },
  hv_bushing: {
    label: 'HV Bushings',
    description:
      'High-voltage insulated pass-throughs for the 3-phase HV leads (230 kV). Capacitance drift indicates insulation aging or moisture ingress. Failure mode is sudden and catastrophic.',
    healthKey: 'bushing',
    sensorIds: ['BUSHING_CAP_HV'],
  },
  lv_bushing: {
    label: 'LV Bushings',
    description:
      'Low-voltage insulated pass-throughs for the 3-phase LV leads (69 kV). Same failure mechanism as HV bushings — monitored via capacitance measurement.',
    healthKey: 'bushing',
    sensorIds: ['BUSHING_CAP_LV'],
  },
  radiator: {
    label: 'Radiator Banks',
    description:
      'Fin-type heat exchangers on both sides of the tank. Dissipate heat from recirculated insulating oil. Efficiency degrades with blocked fins or reduced airflow.',
    healthKey: 'cooling',
    sensorIds: ['TOP_OIL_TEMP', 'BOT_OIL_TEMP'],
  },
  fan_1: {
    label: 'Fan Bank 1',
    description:
      'Stage-1 forced-air cooling fans on the left radiator bank. Activated automatically when top-oil temperature exceeds 65 °C; deactivated below 60 °C.',
    sensorIds: ['FAN_BANK_1'],
  },
  fan_2: {
    label: 'Fan Bank 2',
    description:
      'Stage-2 forced-air cooling fans on the right radiator bank. Activated when top-oil temperature exceeds 75 °C; deactivated below 70 °C.',
    sensorIds: ['FAN_BANK_2'],
  },
  oil_pump: {
    label: 'Oil Pump',
    description:
      'Forced-oil circulation pump. Engaged when load current exceeds 70% or top-oil temperature exceeds 80 °C. Enhances heat transfer from windings to radiators.',
    healthKey: 'cooling',
    sensorIds: ['OIL_PUMP_1'],
  },
  tap_changer: {
    label: 'Tap Changer (OLTC)',
    description:
      'On-load tap changer for voltage ratio adjustment without de-energising. Mechanical contacts wear with each operation; elevated acetylene (C₂H₂) indicates internal arcing.',
    healthKey: 'winding_temp',
    sensorIds: ['TAP_POSITION', 'TAP_OP_COUNT', 'WINDING_TEMP'],
  },
  buchholz_relay: {
    label: 'Buchholz Relay',
    description:
      'Gas-actuated protective relay on the conservator pipe. Detects sudden gas generation or oil flow anomalies caused by internal faults. DGA trends are its primary health proxy.',
    healthKey: 'dga',
    sensorIds: ['DGA_H2', 'DGA_CH4', 'DGA_C2H2', 'DGA_C2H4', 'DGA_C2H6', 'DGA_CO', 'DGA_CO2'],
  },
}
