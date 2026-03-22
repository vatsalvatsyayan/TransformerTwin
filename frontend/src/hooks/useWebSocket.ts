// WebSocket connection, reconnection, and message routing hook

import { useEffect, useRef, useCallback } from 'react'

import { useStore } from '../store'
import type { ServerMessage } from '../types/websocket'
import type { TimelineSeverity } from '../types/timeline'

const WS_URL = 'ws://localhost:8001/ws'

/** Exponential backoff delays (ms): 1s, 2s, 4s, 8s, 16s, 30s max */
const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]

/** Monotonic ID counter for timeline events */
let _timelineId = 0
const nextId = () => ++_timelineId

export function useWebSocket(): void {
  const wsRef              = useRef<WebSocket | null>(null)
  const retryCountRef      = useRef(0)
  const reconnectTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevHealthRef      = useRef<number>(100)
  const prevStageRef       = useRef<string>('')
  const cascadeEmittedRef  = useRef(false)

  const setConnectionStatus = useStore((s) => s.setConnectionStatus)
  const updateReadings      = useStore((s) => s.updateReadings)
  const updateHealth        = useStore((s) => s.updateHealth)
  const addAlert            = useStore((s) => s.addAlert)
  const updateScenario      = useStore((s) => s.updateScenario)
  const setSpeedMultiplier  = useStore((s) => s.setSpeedMultiplier)
  const setSimTime          = useStore((s) => s.setSimTime)
  const addTimelineEvent    = useStore((s) => s.addTimelineEvent)
  const mode                = useStore((s) => s.mode)

  const handleMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case 'connection_ack':
          retryCountRef.current = 0
          setSpeedMultiplier(msg.speed_multiplier)
          setSimTime(msg.sim_time, msg.timestamp)
          addTimelineEvent({
            id: nextId(), simTime: msg.sim_time, wallTime: msg.timestamp,
            type: 'connection', severity: 'info',
            title: 'System Connected',
            detail: 'Live data stream established with TransformerTwin backend.',
          })
          break

        case 'sensor_update':
          // In playback mode, suppress live sensor/health updates so historical
          // state loaded by the slider remains visible.
          if (mode === 'live') {
            updateReadings(msg.group, msg.sensors, msg.sim_time, msg.timestamp)
            setSimTime(msg.sim_time, msg.timestamp)
          }
          break

        case 'health_update': {
          if (mode === 'live') {
            updateHealth(msg.overall_score, msg.previous_score, msg.components, msg.timestamp)
          }
          // Track significant health drops for the timeline (independent of playback mode)
          const drop = prevHealthRef.current - msg.overall_score
          if (drop >= 3) {
            const sev: TimelineSeverity =
              msg.overall_score < 40 ? 'critical'
              : msg.overall_score < 60 ? 'warning'
              : msg.overall_score < 80 ? 'caution'
              : 'info'
            addTimelineEvent({
              id: nextId(), simTime: msg.sim_time, wallTime: msg.timestamp,
              type: 'health_drop', severity: sev,
              title: `Health Index dropped to ${Math.round(msg.overall_score)}/100`,
              detail: `Score fell ${Math.round(drop)} pts (${Math.round(msg.previous_score)} → ${Math.round(msg.overall_score)}).`,
            })
          }
          prevHealthRef.current = msg.overall_score
          break
        }

        case 'alert': {
          // Always add alerts regardless of playback mode
          addAlert(msg.alert)
          const sev: TimelineSeverity =
            msg.alert.severity === 'CRITICAL' ? 'critical'
            : msg.alert.severity === 'WARNING' ? 'warning'
            : 'caution'
          addTimelineEvent({
            id: nextId(), simTime: msg.alert.sim_time, wallTime: msg.alert.timestamp,
            type: 'alert', severity: sev,
            title: msg.alert.title,
            detail: msg.alert.description,
          })
          break
        }

        case 'scenario_update': {
          const cascadeNow = (msg as { cascade_triggered?: boolean }).cascade_triggered ?? false
          updateScenario({
            scenario_id: msg.scenario_id,
            name: msg.name,
            stage: msg.stage,
            progress_percent: msg.progress_percent,
            elapsed_sim_time: msg.elapsed_sim_time,
            cascade_triggered: cascadeNow,
            thermal_fatigue_score: (msg as { thermal_fatigue_score?: number }).thermal_fatigue_score,
          })

          // Emit timeline event on stage changes
          if (msg.stage !== prevStageRef.current) {
            const isActive = msg.scenario_id !== 'normal'
            addTimelineEvent({
              id: nextId(), simTime: msg.elapsed_sim_time, wallTime: new Date().toISOString(),
              type: 'scenario',
              severity: isActive ? (msg.progress_percent > 60 ? 'warning' : 'caution') : 'info',
              title: isActive ? `${msg.name} — ${msg.stage}` : 'Normal Operation Restored',
              detail: isActive
                ? `Fault scenario stage changed (${Math.round(msg.progress_percent)}% elapsed).`
                : 'All fault scenarios cleared. System returning to baseline.',
            })
            prevStageRef.current = msg.stage
          }

          // Cascade event — emitted only once per cascade
          if (cascadeNow && !cascadeEmittedRef.current) {
            cascadeEmittedRef.current = true
            addTimelineEvent({
              id: nextId(), simTime: msg.elapsed_sim_time, wallTime: new Date().toISOString(),
              type: 'cascade', severity: 'critical',
              title: 'CASCADE FAILURE: Thermal → Arcing',
              detail: 'Sustained critical winding temperature triggered arc-generating gas injection. Immediate action required.',
            })
          }
          if (!cascadeNow) cascadeEmittedRef.current = false
          break
        }

        case 'ping':
          wsRef.current?.send(JSON.stringify({ type: 'pong' }))
          break

        case 'error':
          console.warn('[WS] Server error:', msg.code, msg.message)
          break
      }
    },
    [setSpeedMultiplier, setSimTime, updateReadings, updateHealth, addAlert, updateScenario, addTimelineEvent, mode],
  )

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnectionStatus('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnectionStatus('connected')
      retryCountRef.current = 0
    }

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage
        handleMessage(msg)
      } catch {
        console.warn('[WS] Failed to parse message:', event.data)
      }
    }

    ws.onclose = () => {
      setConnectionStatus('disconnected')
      const delay = BACKOFF_DELAYS[Math.min(retryCountRef.current, BACKOFF_DELAYS.length - 1)]
      retryCountRef.current += 1
      reconnectTimerRef.current = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [handleMessage, setConnectionStatus])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [connect])
}
