# TransformerTwin — Frontend Architecture & Implementation Plan

**Version:** 1.0  
**Date:** March 20, 2026  
**Status:** Implementation-Ready  
**Companion Documents:** TransformerTwin PRD v1.0, Backend Architecture v1.0  

---

## Table of Contents

1. Project Structure
2. Component Hierarchy
3. 3D Transformer Visualization
4. Dashboard Layout
5. Real-Time Charts
6. Duval Triangle Visualization
7. Alerts & Diagnostics Panel
8. What-If Simulation Panel
9. Historical Playback
10. WebSocket Integration
11. State Management
12. Theming & Design System
13. Implementation Order
14. Performance Considerations

---

## 1. Project Structure

### 1.1 File Tree

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
│
├── public/
│   └── favicon.svg
│
├── src/
│   ├── main.tsx                          # React root mount
│   ├── App.tsx                           # Top-level layout: Header + Panels + Timeline
│   │
│   ├── types/
│   │   ├── sensors.ts                    # Sensor IDs, reading types, status enums
│   │   ├── alerts.ts                     # Alert, severity, source types
│   │   ├── health.ts                     # HealthScore, component breakdown types
│   │   ├── dga.ts                        # Duval result, TDCG, gas rates types
│   │   ├── fmea.ts                       # FailureMode, evidence, scoring types
│   │   ├── simulation.ts                 # What-if request/response types
│   │   ├── scenario.ts                   # Scenario status, trigger types
│   │   └── websocket.ts                  # All WS message type discriminators
│   │
│   ├── store/
│   │   ├── index.ts                      # Zustand store definition
│   │   ├── slices/
│   │   │   ├── sensorSlice.ts            # Sensor readings + history ring buffers
│   │   │   ├── healthSlice.ts            # Health score + component breakdown
│   │   │   ├── alertSlice.ts             # Active/acknowledged alerts
│   │   │   ├── dgaSlice.ts              # DGA analysis results + Duval state
│   │   │   ├── fmeaSlice.ts             # FMEA failure mode results
│   │   │   ├── scenarioSlice.ts         # Active scenario + progress
│   │   │   ├── connectionSlice.ts       # WS connection state, sim speed
│   │   │   └── playbackSlice.ts         # Historical playback mode + position
│   │   └── selectors.ts                  # Derived/memoized selectors
│   │
│   ├── hooks/
│   │   ├── useWebSocket.ts               # WS connection, reconnection, message routing
│   │   ├── useApi.ts                     # REST API fetch wrappers
│   │   ├── useSensorHistory.ts           # Manages rolling buffer for chart data
│   │   └── usePlayback.ts               # Playback state machine
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx                # App header bar (56px)
│   │   │   ├── MainLayout.tsx            # 55/45 split layout
│   │   │   └── BottomTimeline.tsx        # 48px playback bar
│   │   │
│   │   ├── viewer3d/
│   │   │   ├── TransformerScene.tsx       # R3F Canvas + camera + lights
│   │   │   ├── TransformerModel.tsx       # All transformer meshes grouped
│   │   │   ├── parts/
│   │   │   │   ├── Tank.tsx              # Main tank body
│   │   │   │   ├── Conservator.tsx       # Top cylinder
│   │   │   │   ├── HVBushing.tsx         # Single HV bushing (instanced ×3)
│   │   │   │   ├── LVBushing.tsx         # Single LV bushing (instanced ×3)
│   │   │   │   ├── RadiatorBank.tsx      # Flat panel radiator (instanced ×2)
│   │   │   │   ├── FanUnit.tsx           # Fan disc (instanced ×2)
│   │   │   │   ├── OilPump.tsx           # Cylinder on side
│   │   │   │   ├── TapChanger.tsx        # Box on side
│   │   │   │   └── BuchholzRelay.tsx     # Small cylinder
│   │   │   ├── ComponentTooltip.tsx       # Html overlay tooltip on hover
│   │   │   ├── StatusLegend.tsx           # Color-status legend overlay
│   │   │   └── CameraResetButton.tsx      # Button to reset orbit
│   │   │
│   │   ├── panels/
│   │   │   ├── TabContainer.tsx           # Tab switcher for right panel
│   │   │   ├── SensorPanel.tsx            # Live readings + sparklines
│   │   │   ├── SensorRow.tsx              # Single sensor: name, value, status dot, sparkline
│   │   │   ├── DGAPanel.tsx               # Sub-tabbed: Gas Trends / Duval / Summary
│   │   │   ├── DGAGasTrends.tsx           # 7 gas time-series charts
│   │   │   ├── DuvalTriangle.tsx          # SVG ternary diagram
│   │   │   ├── DGASummary.tsx             # TDCG, CO2/CO, generation rates
│   │   │   ├── FMEAPanel.tsx              # Failure mode diagnostic cards
│   │   │   ├── FMEACard.tsx               # Single FMEA card (collapsible)
│   │   │   ├── WhatIfPanel.tsx            # Simulation controls + projections
│   │   │   └── AlertPanel.tsx             # Alert feed list
│   │   │
│   │   ├── health/
│   │   │   ├── HealthGauge.tsx            # Circular gauge (0–100)
│   │   │   ├── HealthBreakdown.tsx        # Horizontal stacked bar per component
│   │   │   └── HealthTrend.tsx            # Sparkline of score over time
│   │   │
│   │   ├── charts/
│   │   │   ├── SensorSparkline.tsx        # Tiny inline chart (60 points)
│   │   │   ├── SensorLineChart.tsx        # Full time-series chart with threshold bands
│   │   │   └── ProjectionChart.tsx        # What-if timeline projection
│   │   │
│   │   └── common/
│   │       ├── StatusDot.tsx              # Colored circle (4 states)
│   │       ├── AlertBadge.tsx             # Count badge for header
│   │       ├── ConnectionIndicator.tsx    # Green/red dot + label
│   │       ├── SpeedControl.tsx           # Speed multiplier buttons
│   │       └── ScenarioSelector.tsx       # Dropdown to trigger scenarios
│   │
│   ├── lib/
│   │   ├── api.ts                        # fetch wrappers for all REST endpoints
│   │   ├── duvalGeometry.ts              # Ternary math, zone polygons, point-in-polygon
│   │   ├── formatters.ts                 # Number formatting, date formatting, unit display
│   │   └── constants.ts                  # Sensor metadata, threshold values, color maps
│   │
│   └── styles/
│       └── globals.css                   # Tailwind directives + font imports + custom utilities
```

### 1.2 Naming Conventions

- **Components:** `PascalCase.tsx` — one component per file, default export.
- **Hooks:** `useCamelCase.ts` — always prefixed with `use`.
- **Types:** `PascalCase` for interfaces/types, `UPPER_SNAKE_CASE` for enum-like constants.
- **Store slices:** `camelCaseSlice.ts` — each exports typed state + actions.
- **Files:** Components in `PascalCase.tsx`, everything else in `camelCase.ts`.

### 1.3 Dependencies (package.json)

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@react-three/fiber": "^8.16.0",
    "@react-three/drei": "^9.105.0",
    "three": "^0.164.0",
    "recharts": "^2.12.0",
    "zustand": "^4.5.0",
    "tailwindcss": "^3.4.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "@types/react": "^18.3.0",
    "@types/three": "^0.164.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

---

## 2. Component Hierarchy

### 2.1 Full Component Tree

```
App
├── Header
│   ├── ConnectionIndicator          (reads: connectionSlice.status)
│   ├── SpeedControl                  (reads/writes: connectionSlice.speed)
│   ├── ScenarioSelector              (writes: scenarioSlice via REST POST)
│   ├── AlertBadge                    (reads: alertSlice.activeCount)
│   └── HealthGauge (mini)            (reads: healthSlice.overallScore)
│
├── MainLayout
│   ├── LeftPanel (55%)
│   │   └── TransformerScene
│   │       ├── TransformerModel
│   │       │   ├── Tank
│   │       │   ├── Conservator
│   │       │   ├── HVBushing ×3
│   │       │   ├── LVBushing ×3
│   │       │   ├── RadiatorBank ×2
│   │       │   ├── FanUnit ×2
│   │       │   ├── OilPump
│   │       │   ├── TapChanger
│   │       │   └── BuchholzRelay
│   │       ├── ComponentTooltip
│   │       ├── StatusLegend
│   │       └── CameraResetButton
│   │
│   └── RightPanel (45%)
│       └── TabContainer
│           ├── tab="Sensors" → SensorPanel
│           │   └── SensorRow ×21 (one per sensor)
│           │       └── SensorSparkline
│           ├── tab="DGA" → DGAPanel
│           │   ├── sub-tab="Trends" → DGAGasTrends
│           │   │   └── SensorLineChart ×7
│           │   ├── sub-tab="Duval" → DuvalTriangle
│           │   └── sub-tab="Summary" → DGASummary
│           ├── tab="FMEA" → FMEAPanel
│           │   └── FMEACard ×N
│           ├── tab="What-If" → WhatIfPanel
│           │   └── ProjectionChart
│           └── tab="Alerts" → AlertPanel
│
└── BottomTimeline
```

### 2.2 Core Props Interfaces

```typescript
// types/sensors.ts

export type SensorStatus = "NORMAL" | "CAUTION" | "WARNING" | "CRITICAL";

export type SensorGroup = "thermal" | "dga" | "equipment" | "diagnostic";

export interface SensorReading {
  value: number;
  unit: string;
  status: SensorStatus;
  expected?: number;     // From anomaly detection (thermal sensors)
  timestamp: string;
}

export interface SensorHistoryPoint {
  timestamp: string;
  value: number;
  sim_time: number;
}

// 21 sensor IDs as const union type
export type SensorId =
  | "TOP_OIL_TEMP" | "BOT_OIL_TEMP" | "WINDING_TEMP" | "LOAD_CURRENT" | "AMBIENT_TEMP"
  | "DGA_H2" | "DGA_CH4" | "DGA_C2H6" | "DGA_C2H4" | "DGA_C2H2" | "DGA_CO" | "DGA_CO2"
  | "FAN_BANK_1" | "FAN_BANK_2" | "OIL_PUMP_1" | "TAP_POSITION" | "TAP_OP_COUNT"
  | "OIL_MOISTURE" | "OIL_DIELECTRIC" | "BUSHING_CAP_HV" | "BUSHING_CAP_LV";

// types/health.ts

export interface HealthComponent {
  status: SensorStatus;
  penalty: number;
  weight: number;
  contribution: number;
}

export interface HealthScore {
  overall_score: number;
  timestamp: string;
  components: {
    dga: HealthComponent;
    winding_temp: HealthComponent;
    oil_temp: HealthComponent;
    cooling: HealthComponent;
    oil_quality: HealthComponent;
    bushing: HealthComponent;
  };
}

// types/alerts.ts

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface Alert {
  id: number;
  timestamp: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  source: string;
  sensor_ids: string[];
  failure_mode_id: string | null;
  recommended_actions: string[];
  acknowledged: boolean;
  acknowledged_at: string | null;
  sim_time: number;
}

// types/dga.ts

export interface DuvalResult {
  pct_ch4: number;
  pct_c2h4: number;
  pct_c2h2: number;
  zone: string;
  zone_label: string;
  point: { x: number; y: number; z: number };
}

export interface DGAAnalysis {
  timestamp: string;
  duval: DuvalResult;
  tdcg: { value: number; unit: string; status: SensorStatus };
  co2_co_ratio: { value: number; interpretation: string };
  gas_rates: Record<string, { rate_ppm_per_day: number; trend: "RISING" | "STABLE" | "FALLING" }>;
}

// types/fmea.ts

export interface FMEAEvidence {
  condition: string;
  matched: boolean;
  value: string;
}

export interface FMEAResult {
  id: string;
  name: string;
  match_score: number;
  confidence_label: "Monitoring" | "Possible" | "Probable";
  severity: number;
  affected_components: string[];
  evidence: FMEAEvidence[];
  recommended_actions: string[];
  development_time: string;
}

// types/websocket.ts

export type WSMessageType =
  | "connection_ack"
  | "sensor_update"
  | "health_update"
  | "alert"
  | "scenario_update"
  | "ping";

export interface WSSensorUpdate {
  type: "sensor_update";
  timestamp: string;
  sim_time: number;
  group: SensorGroup;
  sensors: Record<string, SensorReading>;
}

export interface WSHealthUpdate {
  type: "health_update";
  timestamp: string;
  sim_time: number;
  overall_score: number;
  previous_score: number;
  components: Record<string, { status: SensorStatus; contribution: number }>;
}

export interface WSAlert {
  type: "alert";
  alert: Alert;
}

export interface WSMessage = WSSensorUpdate | WSHealthUpdate | WSAlert | {
  type: "connection_ack" | "scenario_update" | "ping";
  [key: string]: unknown;
};
```

### 2.3 State Ownership

| State | Owner | Consumers |
|-------|-------|-----------|
| All sensor current values | `sensorSlice` (Zustand) | SensorPanel, SensorRow, TransformerModel, HealthGauge |
| Sensor history (ring buffers) | `sensorSlice` | SensorSparkline, SensorLineChart, DGAGasTrends |
| Health score + components | `healthSlice` | HealthGauge, HealthBreakdown, HealthTrend, Header |
| Alert list | `alertSlice` | AlertPanel, AlertBadge, Header |
| DGA analysis (Duval, TDCG) | `dgaSlice` | DuvalTriangle, DGASummary |
| FMEA results | `fmeaSlice` | FMEAPanel, FMEACard, TransformerModel (highlights) |
| Active scenario + progress | `scenarioSlice` | ScenarioSelector, Header |
| WS connection state + speed | `connectionSlice` | ConnectionIndicator, SpeedControl |
| Playback mode + time position | `playbackSlice` | BottomTimeline, all data consumers |
| Active right-panel tab | Local state in `TabContainer` | TabContainer children |
| Selected 3D component | Local state in `TransformerScene` | ComponentTooltip, detail overlay |
| What-if slider values | Local state in `WhatIfPanel` | ProjectionChart |

---

## 3. 3D Transformer Visualization

### 3.1 Scene Setup

```typescript
// components/viewer3d/TransformerScene.tsx

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";

export default function TransformerScene() {
  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ position: [8, 6, 8], fov: 45, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}  // alpha: true → transparent bg
        dpr={[1, 2]}                            // Retina support, cap at 2x
      >
        {/* Lighting — PRD F1 AC9 */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow={false} />
        <hemisphereLight args={["#1E3A5F", "#0F172A", 0.3]} />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={4}
          maxDistance={20}
          maxPolarAngle={Math.PI * 0.85}  // Prevent flipping under
        />

        <TransformerModel />
      </Canvas>

      {/* Overlay elements */}
      <StatusLegend />
      <CameraResetButton />
    </div>
  );
}
```

### 3.2 Geometry Specification

All dimensions in Three.js world units. The transformer model is centered at origin. 1 unit ≈ 1 meter at real scale (100 MVA transformer is ~4m × 3m × 5m including bushings).

```typescript
// Geometry constants for all transformer components.
// Coordinate system: Y is up, X is width, Z is depth.

export const GEOMETRY = {
  tank: {
    // Main rectangular steel tank body
    shape: "BoxGeometry",
    args: [3.0, 2.5, 2.0] as const,  // width, height, depth
    position: [0, 1.25, 0] as const,  // centered, bottom at Y=0
    material: { color: "#64748B", metalness: 0.6, roughness: 0.4 },
  },

  conservator: {
    // Cylindrical expansion tank on top
    shape: "CylinderGeometry",
    args: [0.3, 0.3, 1.8, 16] as const,  // radiusTop, radiusBot, height, segments
    position: [0, 3.4, 0] as const,        // sits above tank
    rotation: [0, 0, Math.PI / 2] as const, // rotated to lie horizontal along X
    material: { color: "#64748B", metalness: 0.6, roughness: 0.4 },
  },

  conservatorPipe: {
    // Pipe connecting conservator to tank top
    shape: "CylinderGeometry",
    args: [0.08, 0.08, 0.8, 8] as const,
    position: [0.6, 3.0, 0] as const,
    material: { color: "#64748B", metalness: 0.5, roughness: 0.5 },
  },

  hvBushings: {
    // Three tall porcelain bushings (high voltage) — positioned along X on top of tank
    shape: "CylinderGeometry",
    args: [0.08, 0.12, 1.4, 12] as const,  // tapered: narrower at top
    positions: [
      [-0.7, 3.2, -0.3],  // Phase A
      [0, 3.2, -0.3],     // Phase B
      [0.7, 3.2, -0.3],   // Phase C
    ] as const,
    material: { color: "#B87333", metalness: 0.3, roughness: 0.6 },
    // Copper/brown — PRD: model-copper #B87333
  },

  lvBushings: {
    // Three shorter bushings (low voltage) — on opposite side of HV
    shape: "CylinderGeometry",
    args: [0.06, 0.10, 0.8, 12] as const,
    positions: [
      [-0.7, 2.9, 0.3],
      [0, 2.9, 0.3],
      [0.7, 2.9, 0.3],
    ] as const,
    material: { color: "#B87333", metalness: 0.3, roughness: 0.6 },
  },

  radiatorBanks: {
    // Two flat panel radiator banks on sides
    shape: "BoxGeometry",
    args: [0.15, 2.0, 1.6] as const,  // thin, tall, wide panels
    positions: [
      [-1.8, 1.2, 0],   // Left side
      [1.8, 1.2, 0],    // Right side
    ] as const,
    material: { color: "#475569", metalness: 0.5, roughness: 0.5 },
    // PRD: model-radiator #475569
  },

  fanUnits: {
    // Two fan discs at the bottom of radiator banks
    shape: "CylinderGeometry",
    args: [0.35, 0.35, 0.08, 16] as const,  // flat disc
    positions: [
      [-1.8, 0.1, 0],   // Below left radiator
      [1.8, 0.1, 0],    // Below right radiator
    ] as const,
    rotation: [0, 0, Math.PI / 2] as const,  // face outward
    material: { color: "#475569", metalness: 0.4, roughness: 0.6 },
  },

  oilPump: {
    // Cylindrical pump housing on side near bottom
    shape: "CylinderGeometry",
    args: [0.2, 0.2, 0.6, 12] as const,
    position: [1.2, 0.4, 1.2] as const,
    rotation: [Math.PI / 2, 0, 0] as const,  // horizontal
    material: { color: "#475569", metalness: 0.5, roughness: 0.5 },
  },

  tapChanger: {
    // Box-shaped OLTC housing on side
    shape: "BoxGeometry",
    args: [0.6, 0.8, 0.5] as const,
    position: [-1.2, 0.6, 1.2] as const,
    material: { color: "#64748B", metalness: 0.5, roughness: 0.5 },
  },

  buchholzRelay: {
    // Small cylinder on the conservator pipe
    shape: "CylinderGeometry",
    args: [0.1, 0.1, 0.15, 8] as const,
    position: [0.6, 3.0, 0.15] as const,
    material: { color: "#94A3B8", metalness: 0.3, roughness: 0.7 },
  },
} as const;
```

### 3.3 Heat Gradient Implementation

Each component mesh uses `MeshStandardMaterial` with `emissive` and `emissiveIntensity` driven by component health status. This is simpler and more performant than vertex colors or custom shaders.

```typescript
// components/viewer3d/parts/Tank.tsx

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GEOMETRY } from "../geometryConstants";

interface TransformerPartProps {
  componentId: string;
  status: SensorStatus;
  isSelected: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}

// Status → emissive color mapping (PRD F1 AC7)
const STATUS_COLORS: Record<SensorStatus, string> = {
  NORMAL:   "#000000",  // No emissive overlay
  CAUTION:  "#F59E0B",  // Amber at 30% via emissiveIntensity
  WARNING:  "#F97316",  // Orange at 50%
  CRITICAL: "#EF4444",  // Red — will pulse
};

const STATUS_INTENSITY: Record<SensorStatus, number> = {
  NORMAL: 0.0,
  CAUTION: 0.3,
  WARNING: 0.5,
  CRITICAL: 0.7,  // Will oscillate 0.5–0.9 via useFrame
};

export function Tank({ componentId, status, isSelected, onClick, onPointerOver, onPointerOut }: TransformerPartProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!);

  // Pulse animation for CRITICAL status (PRD: 0.5 Hz sinusoidal between 50% and 90%)
  useFrame(({ clock }) => {
    if (status === "CRITICAL" && materialRef.current) {
      const t = clock.getElapsedTime();
      // 0.5 Hz = π radians/second; oscillate between 0.5 and 0.9
      materialRef.current.emissiveIntensity = 0.7 + 0.2 * Math.sin(t * Math.PI);
    }
  });

  const geo = GEOMETRY.tank;

  return (
    <mesh
      ref={meshRef}
      position={geo.position}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <boxGeometry args={geo.args} />
      <meshStandardMaterial
        ref={materialRef}
        color={geo.material.color}
        metalness={geo.material.metalness}
        roughness={geo.material.roughness}
        emissive={STATUS_COLORS[status]}
        emissiveIntensity={STATUS_INTENSITY[status]}
        // Selection highlight
        {...(isSelected ? { wireframe: false, toneMapped: false } : {})}
      />
    </mesh>
  );
}
```

### 3.4 Clickable Components & Tooltip

```typescript
// components/viewer3d/TransformerModel.tsx

import { useState, useCallback } from "react";
import { Html } from "@react-three/drei";
import { useStore } from "../../store";

// Component-to-sensor mapping
const COMPONENT_SENSORS: Record<string, SensorId[]> = {
  tank:           ["TOP_OIL_TEMP", "BOT_OIL_TEMP"],
  conservator:    [],
  hv_bushing_a:   ["BUSHING_CAP_HV"],
  hv_bushing_b:   ["BUSHING_CAP_HV"],
  hv_bushing_c:   ["BUSHING_CAP_HV"],
  lv_bushing_a:   ["BUSHING_CAP_LV"],
  lv_bushing_b:   ["BUSHING_CAP_LV"],
  lv_bushing_c:   ["BUSHING_CAP_LV"],
  radiator_left:  ["TOP_OIL_TEMP"],
  radiator_right: ["TOP_OIL_TEMP"],
  fan_left:       ["FAN_BANK_1"],
  fan_right:      ["FAN_BANK_2"],
  oil_pump:       ["OIL_PUMP_1"],
  tap_changer:    ["TAP_POSITION", "TAP_OP_COUNT"],
  buchholz:       [],
};

// Component → health status derivation
function getComponentStatus(componentId: string, sensors: Record<string, SensorReading>): SensorStatus {
  const sensorIds = COMPONENT_SENSORS[componentId] || [];
  if (sensorIds.length === 0) return "NORMAL";
  const statuses = sensorIds.map(id => sensors[id]?.status ?? "NORMAL");
  const order: SensorStatus[] = ["NORMAL", "CAUTION", "WARNING", "CRITICAL"];
  return statuses.reduce((worst, s) => order.indexOf(s) > order.indexOf(worst) ? s : worst, "NORMAL" as SensorStatus);
}

export default function TransformerModel() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const sensors = useStore(s => s.sensors);

  // ... render all parts with props ...
  // Each part gets: status, isSelected, onClick, onPointerOver, onPointerOut

  return (
    <group>
      <Tank
        componentId="tank"
        status={getComponentStatus("tank", sensors)}
        isSelected={selected === "tank"}
        onClick={() => setSelected(selected === "tank" ? null : "tank")}
        onPointerOver={() => setHovered("tank")}
        onPointerOut={() => setHovered(null)}
      />
      {/* ... all other parts ... */}

      {/* Tooltip overlay */}
      {hovered && (
        <Html position={getTooltipPosition(hovered)} center>
          <div className="bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-slate-100 whitespace-nowrap rounded-sm">
            {COMPONENT_LABELS[hovered]}
          </div>
        </Html>
      )}
    </group>
  );
}
```

### 3.5 Performance Targets

- **Draw calls:** ~15 meshes total (well under GPU limits).
- **Geometry:** All primitives (Box, Cylinder) — no loaded models. Total vertex count <5000.
- **Materials:** Shared materials for same-color parts using `useMemo`.
- **useFrame:** Only runs for CRITICAL pulse animation. For NORMAL/CAUTION/WARNING, `emissiveIntensity` is set once via React state — no per-frame work.
- **Target:** ≥30 FPS on M3 Pro during orbit (PRD F1 AC2). With this geometry budget, 60 FPS is expected.

---

## 4. Dashboard Layout

### 4.1 Grid Specification

```typescript
// App.tsx — top-level layout

export default function App() {
  return (
    <div className="h-screen w-screen flex flex-col bg-[#0F172A] text-[#F1F5F9] overflow-hidden">
      {/* Header — 56px fixed */}
      <Header />  {/* h-14 = 56px */}

      {/* Main content area — fills remaining height minus header and timeline */}
      <div className="flex-1 flex min-h-0">
        {/* Left: 3D Viewport — 55% width */}
        <div className="w-[55%] h-full border-r border-[#475569]">
          <TransformerScene />
        </div>

        {/* Right: Data Panels — 45% width */}
        <div className="w-[45%] h-full overflow-hidden">
          <TabContainer />
        </div>
      </div>

      {/* Bottom Timeline — 48px fixed */}
      <BottomTimeline />  {/* h-12 = 48px */}
    </div>
  );
}
```

### 4.2 Panel Sizing at Target Resolutions

| Resolution | Left (3D) | Right (Data) | Header | Timeline | Data panel height |
|------------|-----------|-------------|--------|----------|------------------|
| 2560×1440 | 1408×1336 | 1152×1336 | 56px | 48px | 1336px |
| 1920×1080 | 1056×976 | 864×976 | 56px | 48px | 976px |

At 1920×1080, the data panel is 864px wide — still enough for charts, sparklines, and cards. Below 1920px width, switch to vertical stacking:

```css
/* In globals.css or via Tailwind responsive */
@media (max-width: 1919px) {
  .main-layout { flex-direction: column; }
  .left-panel { width: 100%; height: 50%; }
  .right-panel { width: 100%; height: 50%; }
}
```

### 4.3 Header Bar Layout

```typescript
// components/layout/Header.tsx

export default function Header() {
  return (
    <header className="h-14 bg-[#1E293B] border-b border-[#475569] flex items-center px-4 gap-4 shrink-0">
      {/* App title */}
      <h1 className="text-xl font-bold text-[#F1F5F9] font-['Inter'] whitespace-nowrap">
        TransformerTwin
      </h1>

      {/* Transformer ID */}
      <span className="text-sm text-[#94A3B8] font-['Inter']">
        TRF-001 · Main Power Transformer Unit 1
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Connection indicator */}
      <ConnectionIndicator />

      {/* Speed control */}
      <SpeedControl />

      {/* Scenario selector */}
      <ScenarioSelector />

      {/* Alert badge */}
      <AlertBadge />

      {/* Mini health gauge */}
      <HealthGauge size="sm" />
    </header>
  );
}
```

---

## 5. Real-Time Charts (Recharts)

### 5.1 Sensor Sparkline (Inline, 60 Points)

```typescript
// components/charts/SensorSparkline.tsx

import { memo } from "react";
import { LineChart, Line, YAxis, ReferenceLine } from "recharts";

interface SparklineProps {
  data: { value: number }[];  // Last 60 readings
  warningThreshold?: number;
  criticalThreshold?: number;
  color?: string;             // Default: #38BDF8 (chart-line-1)
  width?: number;             // Default: 120
  height?: number;            // Default: 24
}

export const SensorSparkline = memo(function SensorSparkline({
  data,
  warningThreshold,
  criticalThreshold,
  color = "#38BDF8",
  width = 120,
  height = 24,
}: SparklineProps) {
  return (
    <LineChart width={width} height={height} data={data}>
      <YAxis hide domain={["auto", "auto"]} />
      <Line
        type="monotone"
        dataKey="value"
        stroke={color}
        strokeWidth={1}
        dot={false}
        isAnimationActive={false}  // CRITICAL: disable animation for perf
      />
      {warningThreshold !== undefined && (
        <ReferenceLine y={warningThreshold} stroke="#F97316" strokeDasharray="2 2" />
      )}
    </LineChart>
  );
});
```

### 5.2 Full Sensor Line Chart (Threshold Bands)

For the DGA Gas Trends and detail sensor views. Uses `ReferenceArea` for colored threshold bands.

```typescript
// components/charts/SensorLineChart.tsx

import { memo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceArea, ResponsiveContainer
} from "recharts";

interface SensorLineChartProps {
  data: { timestamp: string; actual: number; expected?: number }[];
  thresholds: { normal: number; caution: number; warning: number; critical: number };
  unit: string;
  sensorId: string;
}

export const SensorLineChart = memo(function SensorLineChart({
  data, thresholds, unit, sensorId
}: SensorLineChartProps) {
  // Compute Y domain with 20% headroom above max
  const maxVal = Math.max(...data.map(d => d.actual), thresholds.critical);
  const yMax = maxVal * 1.2;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />

        {/* Threshold bands — colored backgrounds */}
        <ReferenceArea y1={0} y2={thresholds.normal} fill="#22C55E" fillOpacity={0.06} />
        <ReferenceArea y1={thresholds.normal} y2={thresholds.caution} fill="#EAB308" fillOpacity={0.08} />
        <ReferenceArea y1={thresholds.caution} y2={thresholds.warning} fill="#F97316" fillOpacity={0.08} />
        <ReferenceArea y1={thresholds.warning} y2={yMax} fill="#EF4444" fillOpacity={0.08} />

        <XAxis
          dataKey="timestamp"
          tick={{ fill: "#64748B", fontSize: 10 }}
          tickFormatter={(t: string) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          stroke="#475569"
        />
        <YAxis
          domain={[0, yMax]}
          tick={{ fill: "#94A3B8", fontSize: 10, fontFamily: "JetBrains Mono" }}
          stroke="#475569"
          unit={` ${unit}`}
        />

        {/* Expected value line (dashed, from anomaly engine) */}
        {data[0]?.expected !== undefined && (
          <Line
            type="monotone"
            dataKey="expected"
            stroke="#64748B"
            strokeWidth={1}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
        )}

        {/* Actual value line */}
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#38BDF8"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />

        <Tooltip
          contentStyle={{
            backgroundColor: "#1E293B",
            border: "1px solid #475569",
            borderRadius: "2px",
            fontSize: 12,
            fontFamily: "JetBrains Mono",
          }}
          labelStyle={{ color: "#94A3B8" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});
```

### 5.3 Rolling Window Management

Each sensor maintains a ring buffer of the last N readings in the Zustand store. The buffer size depends on the sensor group and the time window being displayed.

```typescript
// store/slices/sensorSlice.ts

const MAX_SPARKLINE_POINTS = 60;   // ~5 min of thermal data at 5s intervals
const MAX_CHART_POINTS = 1440;     // ~2 hours of thermal data at 5s intervals

interface SensorState {
  current: Record<SensorId, SensorReading>;
  sparklineBuffers: Record<SensorId, { value: number }[]>;
  chartBuffers: Record<SensorId, { timestamp: string; actual: number; expected?: number }[]>;
}

// When a sensor_update arrives:
function handleSensorUpdate(state: SensorState, msg: WSSensorUpdate): Partial<SensorState> {
  const newCurrent = { ...state.current };
  const newSparklines = { ...state.sparklineBuffers };
  const newCharts = { ...state.chartBuffers };

  for (const [sensorId, reading] of Object.entries(msg.sensors)) {
    const id = sensorId as SensorId;
    newCurrent[id] = reading;

    // Sparkline buffer: push + shift if over limit
    const sparkBuf = [...(newSparklines[id] || []), { value: reading.value }];
    if (sparkBuf.length > MAX_SPARKLINE_POINTS) sparkBuf.shift();
    newSparklines[id] = sparkBuf;

    // Chart buffer: push + shift
    const chartBuf = [
      ...(newCharts[id] || []),
      { timestamp: msg.timestamp, actual: reading.value, expected: reading.expected },
    ];
    if (chartBuf.length > MAX_CHART_POINTS) chartBuf.shift();
    newCharts[id] = chartBuf;
  }

  return { current: newCurrent, sparklineBuffers: newSparklines, chartBuffers: newCharts };
}
```

### 5.4 Performance: Avoiding Re-renders

- **`isAnimationActive={false}`** on all Recharts `<Line>` components — eliminates animation recalculation on every data point.
- **`React.memo`** on chart components — only re-renders when `data` array reference changes.
- **Zustand selectors with shallow comparison** — components subscribe to specific sensor IDs, not the entire sensor state.
- **Throttled chart updates**: Even at 60× speed, update chart components at most once per second using a `requestAnimationFrame` gate in the store update logic.

---

## 6. Duval Triangle Visualization

### 6.1 SVG Implementation

The Duval Triangle is rendered as an SVG with polygon zones and an animated data point.

```typescript
// components/panels/DuvalTriangle.tsx

import { memo, useMemo } from "react";
import { useStore } from "../../store";

// SVG viewport dimensions
const SVG_WIDTH = 340;
const SVG_HEIGHT = 300;

// Triangle vertices in SVG coordinates (equilateral triangle)
// CH4 at top, C2H4 at bottom-right, C2H2 at bottom-left
const TRI_TOP    = { x: SVG_WIDTH / 2, y: 20 };       // CH4 vertex
const TRI_RIGHT  = { x: SVG_WIDTH - 20, y: 280 };     // C2H4 vertex
const TRI_LEFT   = { x: 20, y: 280 };                   // C2H2 vertex

/**
 * Convert ternary coordinates (% summing to 100) to SVG x,y.
 * Standard ternary → Cartesian for equilateral triangle:
 *   point = pct_ch4 * TOP + pct_c2h4 * RIGHT + pct_c2h2 * LEFT
 * where percentages are as fractions (0–1).
 */
function ternaryToSVG(pctCH4: number, pctC2H4: number, pctC2H2: number): { x: number; y: number } {
  const a = pctCH4 / 100;
  const b = pctC2H4 / 100;
  const c = pctC2H2 / 100;
  return {
    x: a * TRI_TOP.x + b * TRI_RIGHT.x + c * TRI_LEFT.x,
    y: a * TRI_TOP.y + b * TRI_RIGHT.y + c * TRI_LEFT.y,
  };
}

// Zone polygon definitions in ternary % [CH4, C2H4, C2H2]
// Each zone is a list of vertices forming a closed polygon.
const ZONE_POLYGONS: Record<string, { vertices: [number, number, number][]; color: string; label: string }> = {
  PD:  { color: "#3B82F6", label: "PD",  vertices: [[98,2,0],[100,0,0],[98,0,2]] },
  T1:  { color: "#22C55E", label: "T1",  vertices: [[98,0,2],[98,2,0],[76,20,4],[76,0,24]] },
  T2:  { color: "#EAB308", label: "T2",  vertices: [[76,20,4],[46,50,4],[46,0,54],[76,0,24]] },
  T3:  { color: "#F97316", label: "T3",  vertices: [[46,50,4],[0,96,4],[0,85,15],[15,50,35],[46,0,54]] },
  D1:  { color: "#A855F7", label: "D1",  vertices: [[23,0,77],[23,23,54],[0,23,77],[0,0,100]] },
  D2:  { color: "#EF4444", label: "D2",  vertices: [[23,23,54],[23,40,37],[0,40,60],[0,23,77]] },
  DT:  { color: "#F59E0B", label: "DT",  vertices: [[46,0,54],[23,23,54],[0,23,77],[0,40,60],[23,40,37],[15,50,35],[0,85,15],[0,96,4],[46,50,4]] },
};

export const DuvalTriangle = memo(function DuvalTriangle() {
  const duval = useStore(s => s.dga?.duval);
  const duvalHistory = useStore(s => s.dga?.duvalHistory ?? []);

  // Convert zone polygons to SVG path strings
  const zonePaths = useMemo(() => {
    return Object.entries(ZONE_POLYGONS).map(([id, zone]) => {
      const points = zone.vertices
        .map(([ch4, c2h4, c2h2]) => {
          const p = ternaryToSVG(ch4, c2h4, c2h2);
          return `${p.x},${p.y}`;
        })
        .join(" ");
      return { id, points, color: zone.color, label: zone.label };
    });
  }, []);

  // Current data point position
  const currentPoint = duval
    ? ternaryToSVG(duval.pct_ch4, duval.pct_c2h4, duval.pct_c2h2)
    : null;

  return (
    <div className="flex flex-col items-center">
      <svg width={SVG_WIDTH} height={SVG_HEIGHT} viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}>
        {/* Zone polygons */}
        {zonePaths.map(z => (
          <polygon
            key={z.id}
            points={z.points}
            fill={z.color}
            fillOpacity={0.25}
            stroke={z.color}
            strokeWidth={1}
            strokeOpacity={0.6}
          />
        ))}

        {/* Triangle outline */}
        <polygon
          points={`${TRI_TOP.x},${TRI_TOP.y} ${TRI_RIGHT.x},${TRI_RIGHT.y} ${TRI_LEFT.x},${TRI_LEFT.y}`}
          fill="none"
          stroke="#94A3B8"
          strokeWidth={1.5}
        />

        {/* Vertex labels */}
        <text x={TRI_TOP.x} y={TRI_TOP.y - 6} textAnchor="middle" fill="#F1F5F9" fontSize={11}>%CH₄</text>
        <text x={TRI_RIGHT.x + 4} y={TRI_RIGHT.y + 14} textAnchor="start" fill="#F1F5F9" fontSize={11}>%C₂H₄</text>
        <text x={TRI_LEFT.x - 4} y={TRI_LEFT.y + 14} textAnchor="end" fill="#F1F5F9" fontSize={11}>%C₂H₂</text>

        {/* Zone labels (centered in each zone) */}
        {zonePaths.map(z => {
          const pts = ZONE_POLYGONS[z.id].vertices;
          const cx = pts.reduce((s, v) => s + v[0], 0) / pts.length;
          const cy = pts.reduce((s, v) => s + v[1], 0) / pts.length;
          const cz = pts.reduce((s, v) => s + v[2], 0) / pts.length;
          const center = ternaryToSVG(cx, cy, cz);
          return (
            <text key={`label-${z.id}`} x={center.x} y={center.y} textAnchor="middle"
                  fill="#F1F5F9" fontSize={10} fontWeight={600} opacity={0.8}>
              {z.label}
            </text>
          );
        })}

        {/* Historical trail — last 10 positions as fading dots */}
        {duvalHistory.map((pt, i) => {
          const pos = ternaryToSVG(pt.pct_ch4, pt.pct_c2h4, pt.pct_c2h2);
          const opacity = 0.15 + (i / duvalHistory.length) * 0.35;
          return <circle key={i} cx={pos.x} cy={pos.y} r={3} fill="#38BDF8" opacity={opacity} />;
        })}

        {/* Current data point */}
        {currentPoint && (
          <circle cx={currentPoint.x} cy={currentPoint.y} r={6} fill="#FFFFFF" stroke="#38BDF8" strokeWidth={2}>
            <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>

      {/* Zone classification label */}
      <div className="mt-2 text-sm font-mono text-[#94A3B8]">
        {duval ? `${duval.zone} — ${duval.zone_label}` : "Awaiting DGA data…"}
      </div>
    </div>
  );
});
```

---

## 7. Alerts & Diagnostics Panels

### 7.1 Alert Panel

```typescript
// components/panels/AlertPanel.tsx

import { useStore } from "../../store";
import { Alert, AlertSeverity } from "../../types/alerts";

const SEVERITY_STYLES: Record<AlertSeverity, string> = {
  INFO:     "border-l-[#3B82F6] bg-[#1E293B]",
  WARNING:  "border-l-[#F97316] bg-[#1E293B]",
  CRITICAL: "border-l-[#EF4444] bg-[#1E293B]",
};

const SEVERITY_BADGE: Record<AlertSeverity, string> = {
  INFO:     "bg-[#3B82F6]/20 text-[#3B82F6]",
  WARNING:  "bg-[#F97316]/20 text-[#F97316]",
  CRITICAL: "bg-[#EF4444]/20 text-[#EF4444]",
};

export default function AlertPanel() {
  const alerts = useStore(s => s.alerts);
  const acknowledgeAlert = useStore(s => s.acknowledgeAlert);

  return (
    <div className="h-full overflow-y-auto p-2 space-y-1">
      {alerts.length === 0 && (
        <div className="flex items-center gap-2 p-4 text-sm text-[#64748B]">
          <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
          No active alerts
        </div>
      )}
      {alerts.map(alert => (
        <AlertCard key={alert.id} alert={alert} onAcknowledge={acknowledgeAlert} />
      ))}
    </div>
  );
}

function AlertCard({ alert, onAcknowledge }: { alert: Alert; onAcknowledge: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border-l-4 ${SEVERITY_STYLES[alert.severity]} p-2 cursor-pointer`}
      style={{ borderRadius: "2px" }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        {/* Pulse dot for unacknowledged */}
        {!alert.acknowledged && (
          <span className="w-2 h-2 mt-1.5 rounded-full bg-current animate-pulse"
                style={{ color: alert.severity === "CRITICAL" ? "#EF4444" : "#F97316" }} />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-sm ${SEVERITY_BADGE[alert.severity]}`}>
              {alert.severity}
            </span>
            <span className="text-xs text-[#64748B] font-mono">
              {new Date(alert.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-sm font-semibold text-[#F1F5F9] mt-0.5 truncate">{alert.title}</p>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 pl-4 space-y-2 text-xs">
          <p className="text-[#94A3B8]">{alert.description}</p>
          {alert.recommended_actions.length > 0 && (
            <div>
              <p className="text-[#64748B] font-semibold mb-1">Recommended Actions:</p>
              <ul className="text-[#94A3B8] space-y-0.5">
                {alert.recommended_actions.map((a, i) => (
                  <li key={i}>→ {a}</li>
                ))}
              </ul>
            </div>
          )}
          {!alert.acknowledged && (
            <button
              onClick={e => { e.stopPropagation(); onAcknowledge(alert.id); }}
              className="text-[#3B82F6] hover:text-[#2563EB] text-xs font-semibold"
            >
              Acknowledge
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

### 7.2 FMEA Card

```typescript
// components/panels/FMEACard.tsx

interface FMEACardProps {
  result: FMEAResult;
  onSelectComponent: (components: string[]) => void;
}

export function FMEACard({ result, onSelectComponent }: FMEACardProps) {
  const [expanded, setExpanded] = useState(false);

  const confidenceColor = result.confidence_label === "Probable"
    ? "#EF4444"
    : result.confidence_label === "Possible"
    ? "#F97316"
    : "#EAB308";

  return (
    <div
      className="bg-[#1E293B] border border-[#475569] p-3 cursor-pointer"
      style={{ borderRadius: "2px" }}
      onClick={() => setExpanded(!expanded)}
      onMouseEnter={() => onSelectComponent(result.affected_components)}
      onMouseLeave={() => onSelectComponent([])}
    >
      {/* Collapsed: name + score + severity */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#F1F5F9]">{result.id}: {result.name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded-sm font-semibold"
                style={{ backgroundColor: `${confidenceColor}20`, color: confidenceColor }}>
            {result.confidence_label} ({Math.round(result.match_score * 100)}%)
          </span>
        </div>
        <span className="text-xs text-[#64748B]">Severity: {result.severity}/10</span>
      </div>

      {/* Score bar */}
      <div className="mt-2 h-1.5 bg-[#334155] rounded-sm overflow-hidden">
        <div className="h-full transition-all duration-300"
             style={{ width: `${result.match_score * 100}%`, backgroundColor: confidenceColor }} />
      </div>

      {/* Expanded: evidence + actions */}
      {expanded && (
        <div className="mt-3 space-y-2 text-xs">
          <div>
            <p className="text-[#64748B] font-semibold mb-1">Evidence:</p>
            {result.evidence.map((e, i) => (
              <div key={i} className="flex items-start gap-1.5 py-0.5">
                <span className={e.matched ? "text-[#22C55E]" : "text-[#64748B]"}>
                  {e.matched ? "✓" : "✗"}
                </span>
                <span className="text-[#94A3B8]">{e.condition}: {e.value}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-[#64748B] font-semibold mb-1">Actions:</p>
            {result.recommended_actions.map((a, i) => (
              <p key={i} className="text-[#94A3B8] pl-2">→ {a}</p>
            ))}
          </div>
          <p className="text-[#64748B]">Timeline: {result.development_time}</p>
        </div>
      )}
    </div>
  );
}
```

---

## 8. What-If Simulation Panel

```typescript
// components/panels/WhatIfPanel.tsx

import { useState, useCallback } from "react";
import { useStore } from "../../store";
import { ProjectionChart } from "../charts/ProjectionChart";

interface WhatIfState {
  load_percent: number;
  ambient_temp_c: number;
  cooling_mode: "ONAN" | "ONAF" | "OFAF";
  time_horizon_days: number;
}

export default function WhatIfPanel() {
  const currentSensors = useStore(s => s.sensors);

  const [params, setParams] = useState<WhatIfState>({
    load_percent: currentSensors.LOAD_CURRENT?.value ?? 70,
    ambient_temp_c: currentSensors.AMBIENT_TEMP?.value ?? 30,
    cooling_mode: "ONAF",
    time_horizon_days: 7,
  });

  const [result, setResult] = useState<SimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const runSimulation = useCallback(async () => {
    setLoading(true);
    // Backend: POST /api/simulation (PRD Section 7.1)
    const res = await fetch("http://localhost:8000/api/simulation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }, [params]);

  const resetToActual = () => {
    setParams({
      load_percent: currentSensors.LOAD_CURRENT?.value ?? 70,
      ambient_temp_c: currentSensors.AMBIENT_TEMP?.value ?? 30,
      cooling_mode: "ONAF",
      time_horizon_days: 7,
    });
    setResult(null);
  };

  return (
    <div className="h-full overflow-y-auto p-3 space-y-4">
      <h3 className="text-sm font-semibold text-[#F1F5F9]">What-If Simulation</h3>

      {/* Load slider: 0–150%, step 1 */}
      <SliderInput
        label="Load Level"
        unit="%"
        min={0} max={150} step={1}
        value={params.load_percent}
        onChange={v => setParams(p => ({ ...p, load_percent: v }))}
        warningAbove={100}
      />

      {/* Ambient temp slider: -10 to 50°C, step 1 */}
      <SliderInput
        label="Ambient Temperature"
        unit="°C"
        min={-10} max={50} step={1}
        value={params.ambient_temp_c}
        onChange={v => setParams(p => ({ ...p, ambient_temp_c: v }))}
      />

      {/* Cooling mode dropdown */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#94A3B8]">Cooling Mode</span>
        <select
          value={params.cooling_mode}
          onChange={e => setParams(p => ({ ...p, cooling_mode: e.target.value as any }))}
          className="bg-[#334155] text-[#F1F5F9] text-xs px-2 py-1 border border-[#475569] rounded-sm"
        >
          <option value="ONAN">ONAN (Natural)</option>
          <option value="ONAF">ONAF (Fans)</option>
          <option value="OFAF">OFAF (Fans + Pumps)</option>
        </select>
      </div>

      {/* Time horizon slider: 1–30 days */}
      <SliderInput
        label="Time Horizon"
        unit=" days"
        min={1} max={30} step={1}
        value={params.time_horizon_days}
        onChange={v => setParams(p => ({ ...p, time_horizon_days: v }))}
      />

      {/* Action buttons */}
      <div className="flex gap-2">
        <button onClick={runSimulation} disabled={loading}
          className="flex-1 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold py-1.5 px-3 rounded-sm">
          {loading ? "Computing…" : "Run Simulation"}
        </button>
        <button onClick={resetToActual}
          className="text-xs text-[#94A3B8] hover:text-[#F1F5F9] px-3 py-1.5 border border-[#475569] rounded-sm">
          Reset
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <ResultCard label="Projected Hot Spot" value={`${result.projected_hotspot_temp_c}°C`}
              alert={result.projected_hotspot_temp_c > 110} />
            <ResultCard label="Projected Top Oil" value={`${result.projected_top_oil_temp_c}°C`}
              alert={result.projected_top_oil_temp_c > 85} />
            <ResultCard label="Aging Factor" value={`${result.aging_acceleration_factor}×`}
              alert={result.aging_acceleration_factor > 4} />
            <ResultCard label="Days to Warning" value={result.estimated_days_to_warning ? `${result.estimated_days_to_warning}` : "N/A"} />
          </div>

          <p className="text-xs text-[#94A3B8]">{result.aging_interpretation}</p>

          {/* Projection chart */}
          <ProjectionChart data={result.projection_timeline} />
        </div>
      )}
    </div>
  );
}

// Reusable slider component
function SliderInput({ label, unit, min, max, step, value, onChange, warningAbove }: {
  label: string; unit: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void; warningAbove?: number;
}) {
  const isWarning = warningAbove !== undefined && value > warningAbove;
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-[#94A3B8]">{label}</span>
        <span className={`text-xs font-mono ${isWarning ? "text-[#EF4444]" : "text-[#F1F5F9]"}`}>
          {value}{unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1 bg-[#334155] rounded-sm appearance-none cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                   [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                   [&::-webkit-slider-thumb]:bg-[#3B82F6]" />
    </div>
  );
}

function ResultCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`bg-[#334155] p-2 rounded-sm ${alert ? "border border-[#EF4444]" : ""}`}>
      <p className="text-[10px] text-[#64748B]">{label}</p>
      <p className={`text-sm font-mono font-semibold ${alert ? "text-[#EF4444]" : "text-[#F1F5F9]"}`}>{value}</p>
    </div>
  );
}
```

---

## 9. Historical Playback

### 9.1 Timeline Component

```typescript
// components/layout/BottomTimeline.tsx

import { useStore } from "../../store";

export default function BottomTimeline() {
  const { isPlayback, playbackTime, liveSimTime, setPlaybackTime, exitPlayback, enterPlayback, playbackSpeed, setPlaybackSpeed } = useStore(s => s.playback);
  const alertMarkers = useStore(s => s.alerts.filter(a => a.severity !== "INFO"));

  // Time range: 0 to current sim_time
  const maxTime = liveSimTime;

  return (
    <div className="h-12 bg-[#1E293B] border-t border-[#475569] flex items-center px-4 gap-3 shrink-0">
      {/* Play/Live toggle */}
      <button onClick={isPlayback ? exitPlayback : () => enterPlayback(maxTime * 0.8)}
        className={`text-xs font-semibold px-2 py-1 rounded-sm ${
          isPlayback
            ? "bg-[#F97316]/20 text-[#F97316]"
            : "bg-[#22C55E]/20 text-[#22C55E]"
        }`}>
        {isPlayback ? "◀ PLAYBACK" : "● LIVE"}
      </button>

      {/* Speed control (playback only) */}
      {isPlayback && (
        <div className="flex gap-1">
          {[1, 10, 30, 60].map(s => (
            <button key={s} onClick={() => setPlaybackSpeed(s)}
              className={`text-[10px] px-1.5 py-0.5 rounded-sm ${
                playbackSpeed === s ? "bg-[#3B82F6] text-white" : "text-[#64748B]"
              }`}>
              {s}×
            </button>
          ))}
        </div>
      )}

      {/* Time slider */}
      <div className="flex-1 relative">
        <input
          type="range" min={0} max={maxTime} step={60}
          value={isPlayback ? playbackTime : maxTime}
          onChange={e => enterPlayback(Number(e.target.value))}
          className="w-full h-1 bg-[#334155] rounded-sm appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2
                     [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#3B82F6]
                     [&::-webkit-slider-thumb]:rounded-sm"
        />

        {/* Alert markers on timeline */}
        {alertMarkers.map(alert => {
          const pos = (alert.sim_time / maxTime) * 100;
          if (pos < 0 || pos > 100) return null;
          return (
            <div key={alert.id}
              className="absolute top-0 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-transparent"
              style={{
                left: `${pos}%`,
                borderBottomColor: alert.severity === "CRITICAL" ? "#EF4444" : "#F97316",
                transform: "translateX(-50%)",
                top: "-8px",
              }}
            />
          );
        })}
      </div>

      {/* Current time display */}
      <span className="text-xs font-mono text-[#94A3B8] w-20 text-right">
        {formatSimTime(isPlayback ? playbackTime : maxTime)}
      </span>
    </div>
  );
}

function formatSimTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
```

### 9.2 Data Fetching Strategy

- **Live mode:** All data comes from WebSocket. Ring buffers hold the last 2 hours of chart data in memory.
- **Playback mode:** When entering playback, fetch the full history for the selected time range via `GET /api/sensors/history`. Fetch once per scrub gesture (debounced 300ms). The store reconstructs the full state at the selected time from the fetched data.
- **State reconstruction:** When the playback slider moves, the store filters all ring buffer data to show only readings ≤ playbackTime. Health score at that time comes from `GET /api/health/history`. DGA analysis is recomputed client-side from the gas values at that time (or fetched).
- **Returning to live:** Calling `exitPlayback()` snaps all displays back to the WebSocket-driven live state.

---

## 10. WebSocket Integration

### 10.1 useWebSocket Hook

```typescript
// hooks/useWebSocket.ts

import { useEffect, useRef, useCallback } from "react";
import { useStore } from "../store";

const WS_URL = "ws://localhost:8000/ws";

// Exponential backoff: 1s, 2s, 4s, 8s, max 30s (PRD F2 AC9)
const BACKOFF_BASE = 1000;
const BACKOFF_MAX = 30000;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);
  const setConnectionState = useStore(s => s.setConnectionState);
  const handleWSMessage = useStore(s => s.handleWSMessage);

  const connect = useCallback(() => {
    setConnectionState("connecting");
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      retryCount.current = 0;
      setConnectionState("connected");
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      handleWSMessage(msg);
    };

    ws.onclose = () => {
      setConnectionState("disconnected");
      const delay = Math.min(BACKOFF_BASE * 2 ** retryCount.current, BACKOFF_MAX);
      retryCount.current++;
      setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [setConnectionState, handleWSMessage]);

  useEffect(() => {
    connect();
    return () => { wsRef.current?.close(); };
  }, [connect]);

  // Expose send function for client→server commands
  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { send };
}
```

### 10.2 Message Routing in Store

```typescript
// store/index.ts (excerpt)

handleWSMessage: (msg: WSMessage) => {
  const state = get();

  switch (msg.type) {
    case "connection_ack":
      set({ simTime: msg.sim_time, speed: msg.speed_multiplier });
      break;

    case "sensor_update":
      // Route to sensor slice — updates current values + ring buffers
      set(sensorSlice.handleUpdate(state, msg as WSSensorUpdate));
      break;

    case "health_update":
      set(healthSlice.handleUpdate(state, msg as WSHealthUpdate));
      break;

    case "alert":
      set(alertSlice.handleNewAlert(state, (msg as WSAlert).alert));
      break;

    case "scenario_update":
      set({ scenario: { ...state.scenario, ...msg } });
      break;
  }
},
```

---

## 11. State Management

### 11.1 Choice: Zustand

**Why Zustand over alternatives:**
- **Performance:** Zustand's selector-based subscriptions mean components re-render only when their specific slice changes. With 5+ sensor updates per second, this avoids the cascade re-renders that React Context or Redux with connected components would cause.
- **Simplicity:** No boilerplate (no reducers, action creators, or providers). A single `create()` call defines the store.
- **Bundle size:** ~1KB vs. Redux at ~7KB. For a POC, less is more.
- **React 18 concurrent features:** Zustand is compatible with concurrent mode and `useSyncExternalStore`.

### 11.2 Store Shape

```typescript
// store/index.ts

import { create } from "zustand";

interface TransformerStore {
  // === Connection ===
  connectionState: "connecting" | "connected" | "disconnected";
  speed: number;              // Simulation speed multiplier
  simTime: number;            // Current simulation time (seconds)
  setConnectionState: (s: string) => void;
  setSpeed: (s: number) => void;

  // === Sensors ===
  sensors: Record<SensorId, SensorReading>;
  sparklineBuffers: Record<SensorId, { value: number }[]>;
  chartBuffers: Record<SensorId, { timestamp: string; actual: number; expected?: number }[]>;

  // === Health ===
  health: HealthScore | null;
  healthHistory: { timestamp: string; score: number }[];  // Max 720 points (2h at 10s intervals)

  // === Alerts ===
  alerts: Alert[];            // Sorted newest-first, max 50 in memory
  activeAlertCount: number;
  acknowledgeAlert: (id: number) => void;

  // === DGA ===
  dga: DGAAnalysis | null;
  duvalHistory: DuvalResult[];  // Last 20 Duval points for trail

  // === FMEA ===
  fmeaResults: FMEAResult[];

  // === Scenario ===
  scenario: {
    active_scenario: string;
    name: string;
    progress_percent: number;
    elapsed_sim_time: number;
    stage?: string;
  };

  // === Playback ===
  playback: {
    isPlayback: boolean;
    playbackTime: number;
    playbackSpeed: number;
    liveSimTime: number;
    enterPlayback: (time: number) => void;
    exitPlayback: () => void;
    setPlaybackTime: (t: number) => void;
    setPlaybackSpeed: (s: number) => void;
  };

  // === Actions ===
  handleWSMessage: (msg: WSMessage) => void;
}

export const useStore = create<TransformerStore>((set, get) => ({
  // ... initial values and action implementations ...
}));
```

### 11.3 Selector Patterns for Performance

```typescript
// Specific selectors to avoid unnecessary re-renders

// ✅ Good: subscribe to single sensor value
const windingTemp = useStore(s => s.sensors.WINDING_TEMP?.value);

// ✅ Good: subscribe to sparkline data for one sensor
const sparklineData = useStore(s => s.sparklineBuffers.WINDING_TEMP);

// ❌ Bad: subscribe to entire sensors object (re-renders on ANY sensor update)
const allSensors = useStore(s => s.sensors);

// ✅ For components that need multiple sensors, use shallow comparison:
import { shallow } from "zustand/shallow";
const { topOil, winding } = useStore(
  s => ({ topOil: s.sensors.TOP_OIL_TEMP, winding: s.sensors.WINDING_TEMP }),
  shallow
);
```

---

## 12. Theming & Design System

### 12.1 Tailwind Configuration

```typescript
// tailwind.config.ts

import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // PRD Section 10.2 color palette
        "tt-bg":          "#0F172A",
        "tt-surface":     "#1E293B",
        "tt-elevated":    "#334155",
        "tt-border":      "#475569",
        "tt-text":        "#F1F5F9",
        "tt-text-sec":    "#94A3B8",
        "tt-text-muted":  "#64748B",
        "tt-accent":      "#3B82F6",
        "tt-accent-hover":"#2563EB",
        "tt-normal":      "#22C55E",
        "tt-caution":     "#EAB308",
        "tt-warning":     "#F97316",
        "tt-critical":    "#EF4444",
        "tt-info":        "#3B82F6",
        "tt-chart-1":     "#38BDF8",
        "tt-chart-2":     "#A78BFA",
        "tt-chart-3":     "#FB923C",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      fontSize: {
        // PRD Section 10.3 typography scale
        "title":  ["20px", { lineHeight: "28px", fontWeight: "700" }],
        "heading":["16px", { lineHeight: "24px", fontWeight: "600" }],
        "body":   ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "data":   ["14px", { lineHeight: "20px", fontWeight: "500" }],
        "label":  ["12px", { lineHeight: "16px", fontWeight: "400" }],
        "score":  ["48px", { lineHeight: "56px", fontWeight: "700" }],
      },
      borderRadius: {
        "industrial": "2px",  // PRD: "2px border-radius maximum"
      },
      animation: {
        "pulse-slow": "pulse 2s ease-in-out infinite",  // 0.5 Hz for critical status
      },
    },
  },
  plugins: [],
} satisfies Config;
```

### 12.2 Font Loading

```css
/* src/styles/globals.css */

@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');

@layer base {
  body {
    @apply bg-tt-bg text-tt-text font-sans;
    -webkit-font-smoothing: antialiased;
  }

  /* Scrollbar styling for industrial look */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #0F172A; }
  ::-webkit-scrollbar-thumb { background: #475569; border-radius: 2px; }
  ::-webkit-scrollbar-thumb:hover { background: #64748B; }
}

/* Status dot animation for critical alerts */
@keyframes critical-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1.0; }
}
```

### 12.3 Reusable Component Patterns

```typescript
// Common panel card style — used by all data containers
// PRD: "No rounded corners on data panels. Use 2px border-radius maximum."
const PANEL_CLASS = "bg-[#1E293B] border border-[#475569] rounded-industrial p-3";

// Common sensor value display
const SENSOR_VALUE_CLASS = "font-mono text-data text-[#F1F5F9]";

// Status dot sizes
const STATUS_DOT = {
  sm: "w-1.5 h-1.5 rounded-full",
  md: "w-2 h-2 rounded-full",
  lg: "w-3 h-3 rounded-full",
};

// Status color class map
function statusColor(status: SensorStatus): string {
  switch (status) {
    case "NORMAL":   return "bg-[#22C55E]";
    case "CAUTION":  return "bg-[#EAB308]";
    case "WARNING":  return "bg-[#F97316]";
    case "CRITICAL": return "bg-[#EF4444]";
  }
}
```

### 12.4 Control Room Aesthetic Checklist

Specific design choices that differentiate this from consumer UI:

1. **Dark steel-blue background** (#0F172A) — not pure black, not material gray.
2. **Monospaced numbers everywhere** — JetBrains Mono for all numeric values.
3. **Border-radius: 2px max** — no rounded pill shapes, no 8px corners.
4. **No shadows** on cards — use borders (#475569) for separation.
5. **Status colors are the only bright colors** — all other UI chrome is desaturated gray-blue.
6. **Dense data layout** — minimal padding, compact sparklines (24px tall), tight line spacing.
7. **No hover animations on data panels** — data should feel fixed and authoritative, not playful.
8. **Subtle grid lines** on charts (#334155) — low contrast, utilitarian.
9. **No icons for decoration** — icons only for functional purposes (camera reset, play/pause).
10. **Sensor labels left-aligned, values right-aligned** with monospace — tabular alignment.

---

## 13. Implementation Order

| Step | What to Build | Produces | Dependencies | Est. Time |
|------|--------------|----------|-------------|-----------|
| 1 | Project scaffolding | Vite + React + TS + Tailwind + R3F project that renders a blue box on dark background | None | 1 hour |
| 2 | `types/` + `lib/constants.ts` | All TypeScript interfaces, sensor metadata, threshold constants | None | 1.5 hours |
| 3 | `store/index.ts` (Zustand) | Store with sensor, health, alert slices + mock data | Step 2 | 1.5 hours |
| 4 | Layout shell: `App.tsx` + `Header.tsx` + `MainLayout` + `BottomTimeline` | 4-zone layout visible with placeholder panels | Step 1 | 1 hour |
| 5 | `TransformerScene` + all 3D parts | Interactive 3D model with orbit controls, click/hover, static colors | Steps 1, 2 | 3 hours |
| 6 | `useWebSocket` hook | WebSocket connects, receives messages, routes to store. Console logs messages. | Steps 2, 3 | 1 hour |
| 7 | `SensorPanel` + `SensorRow` + `SensorSparkline` | Live sensor readings updating in real time from WebSocket | Steps 3, 4, 6 | 2 hours |
| 8 | 3D heat overlays | Tank/bushing/radiator colors update based on live sensor status | Steps 5, 6, 7 | 1 hour |
| 9 | `HealthGauge` + `HealthBreakdown` | Health score gauge in header + component breakdown | Steps 3, 6 | 1.5 hours |
| 10 | `DGAPanel` + `DuvalTriangle` + `DGASummary` | Full DGA tab with gas charts, animated Duval triangle, TDCG display | Steps 3, 6, 7 | 3 hours |
| 11 | `AlertPanel` + `AlertBadge` | Alert feed with severity styling, acknowledgment, header badge | Steps 3, 6 | 1.5 hours |
| 12 | `FMEAPanel` + `FMEACard` | Failure mode cards with scoring, evidence, affected component highlighting | Steps 3, 8, 11 | 2 hours |
| 13 | `ScenarioSelector` + `SpeedControl` | Trigger scenarios from header, adjust sim speed | Step 6 | 1 hour |
| 14 | `WhatIfPanel` + `ProjectionChart` | Sliders, run simulation, display projections | Steps 3, 7 | 2 hours |
| 15 | `BottomTimeline` playback | Time slider, playback controls, state reconstruction | Steps 3, 6, 7 | 2 hours |
| 16 | Polish: transitions, edge states, disconnect banner, loading states | Smooth UX for all error and edge conditions | All prior | 2 hours |

**Total estimated: ~25 hours** (2.5–3 focused days).

---

## 14. Performance Considerations

### 14.1 React Rendering Optimization

- **`React.memo`** on all chart components (`SensorSparkline`, `SensorLineChart`, `DuvalTriangle`). These are the heaviest re-render targets.
- **`useMemo`** for shared Three.js materials (one material per color, not one per mesh instance).
- **`useCallback`** on all event handlers passed as props to 3D components (prevents R3F re-renders).
- **Zustand shallow selectors** for any component reading multiple store values.
- **No state in sensor values that triggers full-tree re-render.** Each `SensorRow` subscribes to exactly one sensor ID.

### 14.2 Three.js Performance

- **Total meshes:** ~15. This is trivially within budget.
- **useFrame only for CRITICAL pulse.** Non-critical components have static materials set via React props — no per-frame work.
- **No shadows** (`castShadow={false}` on all lights and meshes). Shadow maps are expensive and unnecessary for this model complexity.
- **dpr capped at 2** via Canvas `dpr={[1, 2]}`. On retina displays this prevents 4× pixel overdraw.
- **Geometry reuse:** Bushings use the same `CylinderGeometry` instance (different positions). Fan units reuse geometry. This reduces GPU memory.

### 14.3 Chart Performance with Streaming Data

- **`isAnimationActive={false}`** on every Recharts `<Line>`. This single prop eliminates the #1 performance bottleneck with streaming charts.
- **Ring buffers with fixed max size** (60 for sparklines, 1440 for detail charts). Array length never grows unbounded.
- **Throttled store updates**: The `handleWSMessage` function gates chart buffer updates to at most 1 per 200ms at sim speeds above 10×. Sensor current values always update immediately.

### 14.4 Memory Management

- **Sparkline buffers:** 21 sensors × 60 points × ~40 bytes = ~50 KB.
- **Chart buffers:** 21 sensors × 1440 points × ~80 bytes = ~2.4 MB.
- **Health history:** 720 points × ~40 bytes = ~29 KB.
- **Duval history:** 20 points × ~40 bytes = ~0.8 KB.
- **Alert list:** Max 50 alerts × ~500 bytes = ~25 KB.
- **Total in-memory data:** ~3 MB. Well under the 300 MB frontend memory budget (PRD NFR).
- **No memory leaks:** All subscriptions (WebSocket, intervals) are cleaned up in `useEffect` return functions. Zustand store does not accumulate unbounded data due to ring buffer caps.

---

*End of Document*