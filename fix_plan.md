# TransformerTwin — Bug Fix Plan

> Status: Analysis complete. Ready for implementation.
> Authored after reading: `useWebSocket.ts`, `App.tsx`, `TabContainer.tsx`, `BottomTimeline.tsx`,
> `DecisionPanel.tsx`, `TransformerScene.tsx`, `PartDetailPanel.tsx`, `HealthBreakdown.tsx`,
> `store/index.ts`, `main.tsx`, `globals.css`, `AssetKPIBar.tsx`, `ScenarioProgressBar.tsx`

---

## Root Cause Summary

The user reports two symptoms:
1. **App "refreshes"** — the UI briefly resets and sensor data disappears
2. **"Can't click many buttons"** — buttons are unresponsive or layout shifts prevent interaction

Both symptoms trace to **one architectural bug** in `useWebSocket.ts` (Bug #1), which is amplified by **React StrictMode** in development (Bug #2). Together they create multiple simultaneous WebSocket connections and race conditions that corrupt the Zustand store state. The layout-height bugs (#3, #4) contribute to "can't see/reach buttons" on smaller screens.

---

## Bug #1 — HIGH: WebSocket Reconnects on Every Playback Mode Change

**File**: `frontend/src/hooks/useWebSocket.ts`

### What Happens

```
useWebSocket reads:  const mode = useStore((s) => s.mode)
                     ↓
handleMessage = useCallback(..., [..., mode])   ← mode is a dep
                     ↓
connect = useCallback(..., [handleMessage, ...])  ← handleMessage is a dep
                     ↓
useEffect(() => { connect() ... }, [connect])   ← connect is the dep
```

When the user clicks the **LIVE button** in `BottomTimeline.tsx`, `mode` changes from `'playback'`→`'live'` (or vice-versa). This change propagates through the entire chain:

1. `mode` changes in store
2. Zustand notifies subscribers → `useWebSocket` sees new `mode` → causes `App` to re-render
3. `handleMessage` is recreated (mode is a dep)
4. `connect` is recreated (handleMessage is a dep)
5. `useEffect([connect])` cleanup runs: **closes the current WebSocket**
6. `useEffect([connect])` runs: **opens a brand new WebSocket**

This is "the refresh" — the app loses all live data, reconnects, and the backend sends a fresh `connection_ack` that resets `speedMultiplier` and `simTime` in the store.

### The Race Condition (Why Buttons Don't Work)

The closed WebSocket fires `ws.onclose` **asynchronously** (AFTER the effect cleanup and the new effect have already run). The `onclose` handler captures `connect_v1` (the old, stale function) via closure:

```
Timeline:
  t=0: effect cleanup runs synchronously → clearTimeout, closes WS
  t=0: new effect runs synchronously → connect_v2() opens ws2
  t=~5ms: ws.onclose fires → reconnectTimerRef.current = setTimeout(connect_v1, 1000)
  t=~1005ms: connect_v1() fires
             → wsRef.current.readyState: if ws2 is still CONNECTING (0), not OPEN (1)
             → guard fails: opens ws3!
             → wsRef.current = ws3
  t=~1010ms: ws2.onopen fires → connection_ack → resets speedMultiplier/simTime
  t=~1020ms: ws3.onopen fires → second connection_ack → resets speedMultiplier/simTime again
```

**Result**: Two active WebSocket connections (ws2, ws3) both streaming sensor updates to the store simultaneously. The store receives double messages → duplicated timeline events, racing state updates, and buttons that visually reset mid-interaction because the underlying state is being overwritten twice per tick.

### Fix

Remove `mode` from `handleMessage`'s dependency array by reading it through a **ref** instead:

```tsx
// In useWebSocket.ts, replace:
const mode = useStore((s) => s.mode)

// With:
const modeRef = useRef<PlaybackMode>('live')
const mode    = useStore((s) => s.mode)
useEffect(() => { modeRef.current = mode }, [mode])   // keep ref in sync

// Then in handleMessage, replace `mode === 'live'` with `modeRef.current === 'live'`
// And remove `mode` from handleMessage's dependency array:
const handleMessage = useCallback(
  (msg: ServerMessage) => {
    // ... use modeRef.current instead of mode
  },
  [setSpeedMultiplier, setSimTime, updateReadings, updateHealth,
   addAlert, updateScenario, addTimelineEvent],  // ← mode removed
)
```

This breaks the dep chain. `handleMessage` and `connect` become stable references that never get recreated just because the user toggles playback mode. The WebSocket connection persists for the lifetime of the app.

---

## Bug #2 — HIGH: React StrictMode Creates Double WebSocket Connections (Dev Only)

**File**: `frontend/src/main.tsx:9`

### What Happens

React 18 StrictMode intentionally runs every `useEffect` twice in development:
1. First run: `connect()` → opens ws1
2. Cleanup: `wsRef.current?.close()` → closes ws1
3. Second run: `connect()` → ws1 is CLOSING (not OPEN), guard fails → opens ws2
4. ws1.onclose fires (async) → `reconnectTimerRef.current = setTimeout(connect_stale, 1000)`
5. After ~1 second: `connect_stale` fires → checks `wsRef.current.readyState` → if ws2 is still CONNECTING (0), opens ws3

In development, the app ends up with **2–3 WebSocket connections** on startup. This causes:
- 2–3× `connection_ack` messages firing in rapid succession, each resetting `simTime` and `speedMultiplier`
- 2–3× sensor updates per tick hitting the Zustand store (racing writes)
- UI elements that depend on `speedMultiplier` flickering back to their initial state
- Buttons that appear to "not work" because the state they just set gets immediately overwritten by the duplicate stream

### Fix

Add an `isIntentionalCloseRef` boolean ref to distinguish cleanup closes from real disconnects, and guard the `onclose` reconnect logic:

```tsx
// In useWebSocket.ts, add inside the hook:
const isIntentionalCloseRef = useRef(false)

// In ws.onclose:
ws.onclose = () => {
  if (isIntentionalCloseRef.current) return   // ← don't reconnect on intentional close
  setConnectionStatus('disconnected')
  const delay = BACKOFF_DELAYS[...]
  retryCountRef.current += 1
  reconnectTimerRef.current = setTimeout(connect, delay)
}

// In the useEffect cleanup:
return () => {
  isIntentionalCloseRef.current = true         // ← mark as intentional before closing
  if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
  wsRef.current?.close()
  // Reset the flag so a fresh connect() can reconnect normally
  setTimeout(() => { isIntentionalCloseRef.current = false }, 0)
}
```

Additionally, strengthen the connect guard to also block when CONNECTING (readyState 0):

```tsx
// Replace:
if (wsRef.current?.readyState === WebSocket.OPEN) return
// With:
const rs = wsRef.current?.readyState
if (rs === WebSocket.OPEN || rs === WebSocket.CONNECTING) return
```

This prevents `connect_stale` from opening a third connection when ws2 hasn't finished connecting yet.

---

## Bug #3 — MEDIUM: Always-Visible Health Strip Takes ~140px, Cramping Tab Content

**File**: `frontend/src/components/panels/TabContainer.tsx:104-110`

### What Happens

The TabContainer always shows a health strip above the tab content:

```tsx
<div className="flex items-center gap-3 px-3 py-2 border-b ... flex-shrink-0">
  <HealthGauge size={64} />
  <div className="flex-1 min-w-0">
    <HealthBreakdown />   {/* 6 rows × ~22px each = ~132px */}
  </div>
</div>
```

`HealthBreakdown` has 6 rows (DGA, Winding, Oil Temp, Cooling, Oil Quality, Bushing) at ~22px each = **~132px**. The strip itself is ~142px tall (132 + 16px padding).

On a 1080p screen, tab content is fine. On a typical 14" MacBook Pro (actual viewport ~820px after browser chrome):
- Header: 56px
- AssetKPIBar: ~58px
- BottomTimeline: 48px
- **Tab bar**: 41px
- **Health strip**: 142px
- **ScenarioProgressBar (during fault)**: ~90px
- **Available for content**: 820 − 56 − 58 − 48 − 41 − 142 − 90 = **~385px**

385px leaves 5–6 sensor rows visible in the Sensors tab, and in Decision tab the OperatorControls (the top element, ~200px) would be visible but the Risk Assessment below it would be cut off. Since the content area IS `overflow-auto` and scrollable, buttons below the fold can be reached by scrolling — but users often don't realize they need to scroll, explaining "can't click buttons."

### Fix

Make the HealthBreakdown compact — instead of a vertical list of 6 rows, show 6 inline colored dots with 2-letter labels in a single horizontal row. This reduces the health strip from ~142px to ~50px, gaining ~90px of tab content area.

Alternatively, make the health strip collapsible with a chevron toggle (default: collapsed on screens < 900px).

The HealthGauge and 6 dot-rows combined can fit in ~48px:

```tsx
{/* Replace the existing health strip content with a compact single-row layout */}
<div className="flex items-center gap-3 px-3 py-1.5 border-b ... flex-shrink-0">
  <HealthGauge size={44} />          {/* smaller gauge */}
  <HealthBreakdownCompact />         {/* new: 6 inline colored dots */}
</div>
```

---

## Bug #4 — MEDIUM: `ScenarioProgressBar` Causes Unexpected Layout Shift During Faults

**File**: `frontend/src/components/panels/TabContainer.tsx:113` and `ScenarioProgressBar.tsx`

### What Happens

`ScenarioProgressBar` is `flex-shrink-0` in the TabContainer column. When a fault scenario starts, the component appears and **pushes the entire tab content area down by ~90px**. The user triggers a scenario (e.g., hot_spot), then tries to interact with the content — but the content has shifted, so their clicks land in the wrong place or on the wrong buttons.

The cascade emergency banner adds another ~32px of shift, making the total displacement ~122px when a cascade occurs.

### Fix

Render `ScenarioProgressBar` as an **absolute overlay** at the top of the tab content area rather than a flex-column item. This way it appears ON TOP of the content without displacing it:

```tsx
{/* Tab content — relative positioning context for the progress overlay */}
<div className="flex-1 overflow-auto relative">
  <ScenarioProgressBar />   {/* absolute top-0 left-0 right-0, overlays content */}
  <div className={activeTab === 'Sensors' ? '' : 'hidden'}>
    <SensorPanel />
  </div>
  ...
</div>
```

`ScenarioProgressBar` would need `position: absolute; top: 0; left: 0; right: 0; z-index: 10` instead of `flex-shrink-0`. The tab content below would need `padding-top` when the bar is visible (pass `isActive` as a prop or use CSS `:has()`).

---

## Bug #5 — LOW: Playback Slider `max` Freezes When Entering Playback

**File**: `frontend/src/components/layout/BottomTimeline.tsx:112`

### What Happens

Already documented as ISSUE-007 in `docs/ISSUES.md`. The playback slider's `max` attribute is `Math.max(simTime, 1)` where `simTime` is the store's sim time. In playback mode, `simTime` updates are suppressed (since `sensor_update` messages are ignored in playback mode). This means the slider max freezes at the `simTime` value when playback was entered.

If the user enters playback early (low simTime), they can only scrub back through a small window of history even though the backend has much more data in SQLite.

### Fix

Store a separate `maxAvailableSimTime` value in the store that is ALWAYS updated (not suppressed in playback mode). In `useWebSocket.ts`, update it from `sensor_update` messages regardless of `mode`:

```tsx
// In handleMessage, sensor_update case:
case 'sensor_update':
  setMaxAvailableSimTime(msg.sim_time)   // ← always update max
  if (mode === 'live') {
    updateReadings(...)
    setSimTime(...)
  }
  break
```

Then use `maxAvailableSimTime` instead of `simTime` for the slider's `max`.

---

## Implementation Order

Fix in this order (each bug depends on the previous being stable):

| Priority | Bug | File | Effort |
|----------|-----|------|--------|
| 1 | Bug #1: `mode` ref in useWebSocket | `useWebSocket.ts` | 15 min |
| 2 | Bug #2: StrictMode double-connect guard | `useWebSocket.ts` | 20 min |
| 3 | Bug #3: Compact health strip | `TabContainer.tsx` + new `HealthBreakdownCompact.tsx` | 30 min |
| 4 | Bug #4: ScenarioProgressBar overlay | `TabContainer.tsx` + `ScenarioProgressBar.tsx` | 20 min |
| 5 | Bug #5: Playback slider max | `useWebSocket.ts` + `store/index.ts` + `BottomTimeline.tsx` | 15 min |

**Total estimated effort: ~100 minutes**

Bug #1 + Bug #2 together will eliminate both the "refreshes" and most "can't click" symptoms. Bugs #3 + #4 are UX improvements that help visibility on smaller screens.

---

## Verification Steps (After Fixes)

1. Start backend: `cd backend && .venv/bin/python -m uvicorn main:app --reload --port 8001`
2. Start frontend: `cd frontend && npm run dev`
3. **Test refresh fix**: Click LIVE button in BottomTimeline — WebSocket connection count in Network tab should remain at 1; no brief data loss
4. **Test double-connect fix**: Open browser DevTools Network tab → WS → verify only ONE WebSocket connection is established on page load (not 2 or 3)
5. **Test layout**: Resize browser to 1024×768 — verify tab content area has ≥400px height with fault scenario active
6. **Test scenario shift**: Trigger `hot_spot` scenario — tab content should not jump/shift; progress bar should overlay
7. Run existing tests: `cd frontend && npm test` — all 125 tests must still pass

---

## Files to Change

| File | Change |
|------|--------|
| `frontend/src/hooks/useWebSocket.ts` | Bug #1: mode ref; Bug #2: intentional-close guard + CONNECTING state check; Bug #5: maxAvailableSimTime |
| `frontend/src/store/index.ts` | Bug #5: add `maxAvailableSimTime` state + `setMaxAvailableSimTime` action |
| `frontend/src/components/panels/TabContainer.tsx` | Bug #3: compact health strip; Bug #4: ScenarioProgressBar as overlay |
| `frontend/src/components/health/HealthBreakdown.tsx` | Bug #3: add compact variant or make current one more height-efficient |
| `frontend/src/components/common/ScenarioProgressBar.tsx` | Bug #4: change from flex-shrink-0 block to absolute positioned overlay |
| `frontend/src/components/layout/BottomTimeline.tsx` | Bug #5: use maxAvailableSimTime for slider max |
