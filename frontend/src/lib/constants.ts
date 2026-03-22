// Sensor metadata, threshold values, and color maps

import type { SensorId } from '../types/sensors'

export interface SensorMeta {
  label: string
  unit: string
  group: string
  caution: number
  warning: number
  critical: number
  /** If true, lower values are worse (e.g. dielectric strength). LimitBar inverts direction. */
  invertedScale?: boolean
}

export const SENSOR_META: Partial<Record<SensorId, SensorMeta>> = {
  TOP_OIL_TEMP:   { label: 'Top Oil Temp',       unit: '°C',       group: 'thermal',    caution: 75,  warning: 85,  critical: 95 },
  BOT_OIL_TEMP:   { label: 'Bottom Oil Temp',     unit: '°C',       group: 'thermal',    caution: 60,  warning: 70,  critical: 80 },
  WINDING_TEMP:   { label: 'Winding Temp',        unit: '°C',       group: 'thermal',    caution: 90,  warning: 105, critical: 120 },
  LOAD_CURRENT:   { label: 'Load Current',        unit: '%',        group: 'thermal',    caution: 90,  warning: 110, critical: 130 },
  AMBIENT_TEMP:   { label: 'Ambient Temp',        unit: '°C',       group: 'thermal',    caution: 35,  warning: 40,  critical: 45 },
  DGA_H2:         { label: 'Hydrogen (H₂)',       unit: 'ppm',      group: 'dga',        caution: 100, warning: 700, critical: 1800 },
  DGA_CH4:        { label: 'Methane (CH₄)',       unit: 'ppm',      group: 'dga',        caution: 75,  warning: 200, critical: 600 },
  DGA_C2H6:       { label: 'Ethane (C₂H₆)',      unit: 'ppm',      group: 'dga',        caution: 75,  warning: 150, critical: 400 },
  DGA_C2H4:       { label: 'Ethylene (C₂H₄)',    unit: 'ppm',      group: 'dga',        caution: 50,  warning: 200, critical: 600 },
  DGA_C2H2:       { label: 'Acetylene (C₂H₂)',   unit: 'ppm',      group: 'dga',        caution: 1,   warning: 35,  critical: 200 },
  DGA_CO:         { label: 'Carbon Monoxide (CO)', unit: 'ppm',     group: 'dga',        caution: 350, warning: 900, critical: 1800 },
  DGA_CO2:        { label: 'Carbon Dioxide (CO₂)', unit: 'ppm',    group: 'dga',        caution: 2500, warning: 4000, critical: 9000 },
  OIL_MOISTURE:   { label: 'Oil Moisture',        unit: 'ppm',      group: 'diagnostic', caution: 15,  warning: 25,  critical: 35 },
  OIL_DIELECTRIC: { label: 'Oil Dielectric',      unit: 'kV',       group: 'diagnostic', caution: 45,  warning: 40,  critical: 30, invertedScale: true },
  BUSHING_CAP_HV: { label: 'HV Bushing Cap.',     unit: 'pF',       group: 'diagnostic', caution: 525, warning: 550, critical: 600 },
  BUSHING_CAP_LV: { label: 'LV Bushing Cap.',     unit: 'pF',       group: 'diagnostic', caution: 440, warning: 462, critical: 504 },
  TAP_POSITION:   { label: 'Tap Position',        unit: 'position', group: 'equipment',  caution: 28,  warning: 31,  critical: 33 },
  TAP_OP_COUNT:   { label: 'Tap Op. Count',       unit: 'count',    group: 'equipment',  caution: 50000, warning: 80000, critical: 100000 },
  FAN_BANK_1:     { label: 'Fan Bank 1',          unit: '',         group: 'equipment',  caution: 1, warning: 1, critical: 1 },
  FAN_BANK_2:     { label: 'Fan Bank 2',          unit: '',         group: 'equipment',  caution: 1, warning: 1, critical: 1 },
  OIL_PUMP_1:     { label: 'Oil Pump 1',          unit: '',         group: 'equipment',  caution: 1, warning: 1, critical: 1 },
}

/** Status color map matching design system */
export const STATUS_COLORS = {
  NORMAL:   '#22c55e',
  CAUTION:  '#eab308',
  WARNING:  '#f97316',
  CRITICAL: '#ef4444',
  ON:       '#22c55e',
  OFF:      '#94a3b8',
} as const

/** Duval zone color map */
export const DUVAL_ZONE_COLORS: Record<string, string> = {
  PD: '#a855f7',   // purple
  T1: '#f97316',   // orange
  T2: '#ef4444',   // red
  T3: '#b91c1c',   // dark red
  D1: '#3b82f6',   // blue
  D2: '#1d4ed8',   // dark blue
  DT: '#8b5cf6',   // violet
  NONE: '#64748b', // gray
}
