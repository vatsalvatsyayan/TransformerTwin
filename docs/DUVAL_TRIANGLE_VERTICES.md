# TransformerTwin — Duval Triangle Zone Definitions

> **Status:** Implementation-Ready
> **Standard:** IEC 60599:2022 (Interpretation of dissolved gas analysis), Michel Duval (2002)
> **Applies to:** `analytics/dga_analyzer.py`, `frontend/src/lib/duvalGeometry.ts`, `frontend/src/components/charts/DuvalTriangle.tsx`

This document defines the zone classifier rules (for the backend analyzer) and SVG polygon coordinates (for the frontend renderer). Both layers must use these definitions.

---

## 1. What the Duval Triangle Measures

The Duval Triangle uses the **relative proportions** of three key fault gases, not their absolute ppm values:

```
%CH4  = DGA_CH4  / (DGA_CH4 + DGA_C2H4 + DGA_C2H2) × 100
%C2H4 = DGA_C2H4 / (DGA_CH4 + DGA_C2H4 + DGA_C2H2) × 100
%C2H2 = DGA_C2H2 / (DGA_CH4 + DGA_C2H4 + DGA_C2H2) × 100
```

**Guard condition:** If `DGA_CH4 + DGA_C2H4 + DGA_C2H2 < 0.1 ppm` → return zone `"NONE"` (insufficient data).

The three percentages always sum to 100.

---

## 2. Zone Definitions — Classifier Rules

The backend `analytics/dga_analyzer.py` must implement zone classification using these rule-based conditions. Rules are checked in the order listed (first match wins).

| Priority | Zone | Name | Rule |
|----------|------|------|------|
| 1 | `NONE` | Insufficient Data | `CH4 + C2H4 + C2H2 < 0.1 ppm` (sum of raw ppm, not %) |
| 2 | `PD` | Partial Discharge | `%C2H2 < 0.1` AND `%C2H4 < 4` AND `%CH4 > 95` |
| 3 | `DT` | Discharge + Thermal | `%C2H2 >= 29` |
| 4 | `D1` | Low Energy Discharge | `%C2H2 >= 13` AND `%C2H4 <= %C2H2 * 1.0` |
| 5 | `D2` | High Energy Discharge | `%C2H2 >= 13` AND `%C2H4 > %C2H2 * 1.0` |
| 6 | `T3` | Thermal > 700°C | `%C2H4 >= 50` AND `%C2H2 < 13` |
| 7 | `T2` | Thermal 300–700°C | `%C2H4 >= 20` AND `%C2H4 < 50` AND `%C2H2 < 13` |
| 8 | `T1` | Thermal < 300°C | `%C2H4 >= 4` AND `%C2H4 < 20` AND `%C2H2 < 13` |
| 9 | `T1` | Default low-temp | Catch-all (should not normally be reached if PD was not matched) |

**Python implementation skeleton:**

```python
def classify_duval_zone(ch4_ppm: float, c2h4_ppm: float, c2h2_ppm: float) -> str:
    """Classify Duval Triangle zone. Returns a DuvalZone string."""
    total = ch4_ppm + c2h4_ppm + c2h2_ppm
    if total < 0.1:
        return "NONE"

    pct_ch4  = ch4_ppm  / total * 100.0
    pct_c2h4 = c2h4_ppm / total * 100.0
    pct_c2h2 = c2h2_ppm / total * 100.0

    if pct_c2h2 < 0.1 and pct_c2h4 < 4.0 and pct_ch4 > 95.0:
        return "PD"
    if pct_c2h2 >= 29.0:
        return "DT"
    if pct_c2h2 >= 13.0 and pct_c2h4 <= pct_c2h2:
        return "D1"
    if pct_c2h2 >= 13.0 and pct_c2h4 > pct_c2h2:
        return "D2"
    if pct_c2h4 >= 50.0 and pct_c2h2 < 13.0:
        return "T3"
    if 20.0 <= pct_c2h4 < 50.0 and pct_c2h2 < 13.0:
        return "T2"
    return "T1"  # Covers T1 and PD boundary area
```

---

## 3. Coordinate System

The triangle is rendered in a 2D SVG canvas. Ternary coordinates map to Cartesian as follows:

```
%C2H2 = 100  →  Top vertex:         (0.5,  0.866)  in normalized coords
%C2H4 = 100  →  Bottom-right:       (1.0,  0.000)
%CH4  = 100  →  Bottom-left:        (0.0,  0.000)
```

**Ternary → Cartesian formula:**

```typescript
// Normalized [0,1] Cartesian from ternary percentages
function ternaryToCartesian(pctCH4: number, pctC2H4: number, pctC2H2: number): [number, number] {
  const x = pctC2H4 / 100 + pctC2H2 / 100 * 0.5;
  const y = pctC2H2 / 100 * (Math.sqrt(3) / 2);  // Math.sqrt(3)/2 ≈ 0.866
  return [x, y];
}

// Scale to SVG pixel coordinates (SVG width × height, with padding)
// For a 500×433px triangle canvas (500 wide, sqrt(3)/2*500 tall):
function toSVGPoint(x: number, y: number, svgSize: number = 500): [number, number] {
  const svgHeight = svgSize * (Math.sqrt(3) / 2);
  return [
    x * svgSize,
    svgHeight - y * svgSize,  // Flip Y: SVG origin is top-left
  ];
}
```

---

## 4. Zone Polygon Vertices

All vertices given in ternary (pctCH4, pctC2H4, pctC2H2) format where they sum to 100. The Cartesian (x, y) equivalents (normalized 0–1) are also provided for direct use in `duvalGeometry.ts`.

### Zone PD — Partial Discharge
Color: `#9333ea` (purple)

| Ternary (CH4, C2H4, C2H2) | Cartesian (x, y) |
|---------------------------|-----------------|
| (100.0, 0.0, 0.0) | (0.000, 0.000) |
| (96.0, 4.0, 0.0) | (0.040, 0.000) |
| (95.9, 4.0, 0.1) | (0.041, 0.001) |
| (99.9, 0.0, 0.1) | (0.001, 0.001) |

### Zone T1 — Thermal < 300°C
Color: `#f59e0b` (amber)

| Ternary (CH4, C2H4, C2H2) | Cartesian (x, y) |
|---------------------------|-----------------|
| (96.0, 4.0, 0.0) | (0.040, 0.000) |
| (80.0, 20.0, 0.0) | (0.200, 0.000) |
| (67.0, 20.0, 13.0) | (0.265, 0.113) |
| (83.0, 4.0, 13.0) | (0.105, 0.113) |
| (95.9, 4.0, 0.1) | (0.041, 0.001) |

### Zone T2 — Thermal 300–700°C
Color: `#f97316` (orange)

| Ternary (CH4, C2H4, C2H2) | Cartesian (x, y) |
|---------------------------|-----------------|
| (80.0, 20.0, 0.0) | (0.200, 0.000) |
| (50.0, 50.0, 0.0) | (0.500, 0.000) |
| (37.0, 50.0, 13.0) | (0.565, 0.113) |
| (67.0, 20.0, 13.0) | (0.265, 0.113) |

### Zone T3 — Thermal > 700°C
Color: `#ef4444` (red)

| Ternary (CH4, C2H4, C2H2) | Cartesian (x, y) |
|---------------------------|-----------------|
| (50.0, 50.0, 0.0) | (0.500, 0.000) |
| (0.0, 100.0, 0.0) | (1.000, 0.000) |
| (0.0, 87.0, 13.0) | (0.935, 0.113) |
| (37.0, 50.0, 13.0) | (0.565, 0.113) |

### Zone D1 — Low Energy Discharge
Color: `#3b82f6` (blue)

| Ternary (CH4, C2H4, C2H2) | Cartesian (x, y) |
|---------------------------|-----------------|
| (83.0, 4.0, 13.0) | (0.105, 0.113) |
| (67.0, 20.0, 13.0) | (0.265, 0.113) |
| (37.0, 50.0, 13.0) | (0.565, 0.113) |
| (35.5, 35.5, 29.0) | (0.500, 0.251) |
| (41.0, 30.0, 29.0) | (0.445, 0.251) |
| (71.0, 0.0, 29.0) | (0.145, 0.251) |

*Note: D1 is the upper-left portion of the 13–29% C2H2 band, bounded by the C2H2=C2H4 diagonal line.*

### Zone D2 — High Energy Discharge
Color: `#06b6d4` (cyan)

| Ternary (CH4, C2H4, C2H2) | Cartesian (x, y) |
|---------------------------|-----------------|
| (37.0, 50.0, 13.0) | (0.565, 0.113) |
| (0.0, 87.0, 13.0) | (0.935, 0.113) |
| (0.0, 71.0, 29.0) | (0.855, 0.251) |
| (35.5, 35.5, 29.0) | (0.500, 0.251) |

*Note: D2 is the upper-right portion of the 13–29% C2H2 band.*

### Zone DT — Discharge + Thermal
Color: `#8b5cf6` (violet)

| Ternary (CH4, C2H4, C2H2) | Cartesian (x, y) |
|---------------------------|-----------------|
| (71.0, 0.0, 29.0) | (0.145, 0.251) |
| (41.0, 30.0, 29.0) | (0.445, 0.251) |
| (35.5, 35.5, 29.0) | (0.500, 0.251) |
| (0.0, 71.0, 29.0) | (0.855, 0.251) |
| (0.0, 0.0, 100.0) | (0.500, 0.866) |

---

## 5. Zone Colors Reference

```typescript
// frontend/src/lib/duvalGeometry.ts
export const DUVAL_ZONE_COLORS: Record<string, string> = {
  PD:   "#9333ea",  // purple  — Partial Discharge
  T1:   "#f59e0b",  // amber   — Thermal < 300°C
  T2:   "#f97316",  // orange  — Thermal 300–700°C
  T3:   "#ef4444",  // red     — Thermal > 700°C
  D1:   "#3b82f6",  // blue    — Low Energy Discharge
  D2:   "#06b6d4",  // cyan    — High Energy Discharge
  DT:   "#8b5cf6",  // violet  — Discharge + Thermal
  NONE: "#374151",  // gray    — No data
};

export const DUVAL_ZONE_LABELS: Record<string, string> = {
  PD:   "Partial Discharge",
  T1:   "Thermal < 300°C",
  T2:   "Thermal 300–700°C",
  T3:   "Thermal > 700°C",
  D1:   "Low Energy Discharge",
  D2:   "High Energy Discharge",
  DT:   "Discharge + Thermal",
  NONE: "Insufficient Data",
};
```

---

## 6. `duvalGeometry.ts` Data Structure

```typescript
// frontend/src/lib/duvalGeometry.ts

export interface DuvalZonePolygon {
  zone: string;            // DuvalZone string
  label: string;
  color: string;
  // Normalized Cartesian vertices [x, y], each in range [0,1]
  // x increases right (toward C2H4=100%), y increases up (toward C2H2=100%)
  vertices: [number, number][];
}

// All 7 zone polygons ready to render
export const DUVAL_ZONE_POLYGONS: DuvalZonePolygon[] = [
  {
    zone: "PD",
    label: "Partial Discharge",
    color: "#9333ea",
    vertices: [[0.000,0.000],[0.040,0.000],[0.041,0.001],[0.001,0.001]],
  },
  {
    zone: "T1",
    label: "Thermal < 300°C",
    color: "#f59e0b",
    vertices: [[0.040,0.000],[0.200,0.000],[0.265,0.113],[0.105,0.113],[0.041,0.001]],
  },
  {
    zone: "T2",
    label: "Thermal 300–700°C",
    color: "#f97316",
    vertices: [[0.200,0.000],[0.500,0.000],[0.565,0.113],[0.265,0.113]],
  },
  {
    zone: "T3",
    label: "Thermal > 700°C",
    color: "#ef4444",
    vertices: [[0.500,0.000],[1.000,0.000],[0.935,0.113],[0.565,0.113]],
  },
  {
    zone: "D1",
    label: "Low Energy Discharge",
    color: "#3b82f6",
    vertices: [[0.105,0.113],[0.265,0.113],[0.565,0.113],[0.500,0.251],[0.445,0.251],[0.145,0.251]],
  },
  {
    zone: "D2",
    label: "High Energy Discharge",
    color: "#06b6d4",
    vertices: [[0.565,0.113],[0.935,0.113],[0.855,0.251],[0.500,0.251]],
  },
  {
    zone: "DT",
    label: "Discharge + Thermal",
    color: "#8b5cf6",
    vertices: [[0.145,0.251],[0.445,0.251],[0.500,0.251],[0.855,0.251],[0.500,0.866]],
  },
];
```

---

## 7. SVG Rendering Guide

The `DuvalTriangle.tsx` component renders:
1. A filled equilateral triangle outline
2. Each zone polygon, filled with its color at 60% opacity
3. Axis labels: "CH4 →" on bottom-left, "C2H4 →" on bottom-right, "C2H2 ↑" on left
4. The current live point as a white circle, diameter 8px
5. Historical trail (last 20 readings) as smaller dots fading from white to transparent

**Coordinate transform for SVG (TypeScript):**

```typescript
const SVG_WIDTH = 500;
const SVG_HEIGHT = SVG_WIDTH * (Math.sqrt(3) / 2);  // ≈ 433
const PADDING = 40;  // px around the triangle

function normalizedToSVG(nx: number, ny: number): [number, number] {
  // Map normalized [0,1] coordinates to SVG pixel space with padding
  const usableW = SVG_WIDTH - 2 * PADDING;
  const usableH = SVG_HEIGHT - 2 * PADDING;
  return [
    PADDING + nx * usableW,
    (SVG_HEIGHT - PADDING) - ny * usableH,  // Flip Y
  ];
}

function polygonToSVGPoints(vertices: [number, number][]): string {
  return vertices
    .map(([x, y]) => normalizedToSVG(x, y).join(","))
    .join(" ");
}
```

---

## 8. Validation — Zone Classification Tests

Use these to verify the classifier produces correct results:

| CH4 ppm | C2H4 ppm | C2H2 ppm | Expected Zone | Reason |
|---------|----------|----------|---------------|--------|
| 10.0 | 0.05 | 0.0 | NONE | Sum < 0.1 ppm |
| 8.0 | 3.0 | 0.2 | T1 | C2H4~27%, C2H2~2% → T1 |
| 8.0 | 8.0 | 0.2 | T1/T2 boundary | C2H4~49%, check rule order |
| 50.0 | 100.0 | 0.5 | T2 | C2H4~66%, C2H2~0.3% → T3 |
| 10.0 | 5.0 | 20.0 | D1 | C2H2~57%, C2H4<C2H2 → D1 |
| 5.0 | 25.0 | 20.0 | D2 | C2H2~40%, C2H4>C2H2 → D2 |
| 5.0 | 5.0 | 90.0 | DT | C2H2~90% ≥ 29% → DT |
| 99.0 | 1.0 | 0.0 | PD | CH4~99%, C2H4~1%, C2H2~0% → PD |

*Row 3 correction: 50+100+0.5=150.5; C2H4=100/150.5=66.4% → T3 (≥50%)*
