// Sensor types — all values match Integration Contract Section 1.1 exactly

export type SensorStatus = 'NORMAL' | 'CAUTION' | 'WARNING' | 'CRITICAL'

export type SensorGroup = 'thermal' | 'dga' | 'equipment' | 'diagnostic'

export type SensorId =
  // Thermal / Electrical — group: "thermal", interval: 5s
  | 'TOP_OIL_TEMP'      // °C
  | 'BOT_OIL_TEMP'      // °C
  | 'WINDING_TEMP'      // °C
  | 'LOAD_CURRENT'      // %
  | 'AMBIENT_TEMP'      // °C
  // DGA — group: "dga", interval: 300s
  | 'DGA_H2'            // ppm
  | 'DGA_CH4'           // ppm
  | 'DGA_C2H6'          // ppm
  | 'DGA_C2H4'          // ppm
  | 'DGA_C2H2'          // ppm
  | 'DGA_CO'            // ppm
  | 'DGA_CO2'           // ppm
  // Equipment — group: "equipment", interval: 10s
  | 'FAN_BANK_1'        // boolean (0 or 1 as number)
  | 'FAN_BANK_2'        // boolean (0 or 1 as number)
  | 'OIL_PUMP_1'        // boolean (0 or 1 as number)
  | 'TAP_POSITION'      // integer 1–33
  | 'TAP_OP_COUNT'      // integer
  // Slow Diagnostics — group: "diagnostic", interval: 3600s
  | 'OIL_MOISTURE'      // ppm
  | 'OIL_DIELECTRIC'    // kV
  | 'BUSHING_CAP_HV'    // pF
  | 'BUSHING_CAP_LV'    // pF

export const ALL_SENSOR_IDS: SensorId[] = [
  'TOP_OIL_TEMP', 'BOT_OIL_TEMP', 'WINDING_TEMP', 'LOAD_CURRENT', 'AMBIENT_TEMP',
  'DGA_H2', 'DGA_CH4', 'DGA_C2H6', 'DGA_C2H4', 'DGA_C2H2', 'DGA_CO', 'DGA_CO2',
  'FAN_BANK_1', 'FAN_BANK_2', 'OIL_PUMP_1', 'TAP_POSITION', 'TAP_OP_COUNT',
  'OIL_MOISTURE', 'OIL_DIELECTRIC', 'BUSHING_CAP_HV', 'BUSHING_CAP_LV',
]

export const SENSOR_GROUP_MAP: Record<SensorId, SensorGroup> = {
  TOP_OIL_TEMP: 'thermal',
  BOT_OIL_TEMP: 'thermal',
  WINDING_TEMP: 'thermal',
  LOAD_CURRENT: 'thermal',
  AMBIENT_TEMP: 'thermal',
  DGA_H2: 'dga',
  DGA_CH4: 'dga',
  DGA_C2H6: 'dga',
  DGA_C2H4: 'dga',
  DGA_C2H2: 'dga',
  DGA_CO: 'dga',
  DGA_CO2: 'dga',
  FAN_BANK_1: 'equipment',
  FAN_BANK_2: 'equipment',
  OIL_PUMP_1: 'equipment',
  TAP_POSITION: 'equipment',
  TAP_OP_COUNT: 'equipment',
  OIL_MOISTURE: 'diagnostic',
  OIL_DIELECTRIC: 'diagnostic',
  BUSHING_CAP_HV: 'diagnostic',
  BUSHING_CAP_LV: 'diagnostic',
}

export interface SensorReading {
  value: number
  unit: string
  status: string // SensorStatus | "ON" | "OFF" for equipment
  expected?: number  // Only present for thermal sensors
  timestamp?: string
}

export interface SensorHistoryPoint {
  timestamp: string
  value: number
  sim_time: number
}

export type SensorReadings = Record<SensorId, SensorReading>
