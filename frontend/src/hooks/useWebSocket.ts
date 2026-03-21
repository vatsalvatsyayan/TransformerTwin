// WebSocket connection, reconnection, and message routing hook

import { useEffect, useRef, useCallback } from 'react'

import { useStore } from '../store'
import type { ServerMessage } from '../types/websocket'

const WS_URL = 'ws://localhost:8001/ws'

/** Exponential backoff delays (ms): 1s, 2s, 4s, 8s, 16s, 30s max */
const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]

export function useWebSocket(): void {
  const wsRef = useRef<WebSocket | null>(null)
  const retryCountRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setConnectionStatus = useStore((s) => s.setConnectionStatus)
  const updateReadings = useStore((s) => s.updateReadings)
  const updateHealth = useStore((s) => s.updateHealth)
  const addAlert = useStore((s) => s.addAlert)
  const updateScenario = useStore((s) => s.updateScenario)
  const setSpeedMultiplier = useStore((s) => s.setSpeedMultiplier)
  const setSimTime = useStore((s) => s.setSimTime)
  const mode = useStore((s) => s.mode)

  const handleMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case 'connection_ack':
          retryCountRef.current = 0
          setSpeedMultiplier(msg.speed_multiplier)
          setSimTime(msg.sim_time, msg.timestamp)
          break

        case 'sensor_update':
          // In playback mode, suppress live sensor/health updates so historical
          // state loaded by the slider remains visible.
          if (mode === 'live') {
            updateReadings(msg.group, msg.sensors, msg.sim_time, msg.timestamp)
            setSimTime(msg.sim_time, msg.timestamp)
          }
          break

        case 'health_update':
          if (mode === 'live') {
            updateHealth(
              msg.overall_score,
              msg.previous_score,
              msg.components,
              msg.timestamp,
            )
          }
          break

        case 'alert':
          // Always add alerts regardless of playback mode
          addAlert(msg.alert)
          break

        case 'scenario_update':
          updateScenario({
            scenario_id: msg.scenario_id,
            name: msg.name,
            stage: msg.stage,
            progress_percent: msg.progress_percent,
            elapsed_sim_time: msg.elapsed_sim_time,
          })
          break

        case 'ping':
          wsRef.current?.send(JSON.stringify({ type: 'pong' }))
          break

        case 'error':
          console.warn('[WS] Server error:', msg.code, msg.message)
          break
      }
    },
    [setSpeedMultiplier, setSimTime, updateReadings, updateHealth, addAlert, updateScenario, mode],
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
