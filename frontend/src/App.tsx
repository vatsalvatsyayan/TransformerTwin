// Top-level layout: Header + MainLayout + BottomTimeline
// Initialises WebSocket connection on mount

import { useEffect } from 'react'
import { Header } from './components/layout/Header'
import { MainLayout } from './components/layout/MainLayout'
import { BottomTimeline } from './components/layout/BottomTimeline'
import { useWebSocket } from './hooks/useWebSocket'
import { useStore } from './store'
import { fetchCurrentSensors, fetchAlerts, fetchHealth } from './hooks/useApi'

export default function App() {
  // Establish WebSocket connection (reconnects automatically)
  useWebSocket()

  const connectionStatus = useStore((s) => s.connectionStatus)
  const hasData = useStore((s) => Object.keys(s.readings).length > 0)

  // Fetch initial REST data on mount — errors are logged but not fatal
  useEffect(() => {
    fetchCurrentSensors().catch((err: unknown) => console.warn('[Init] sensors fetch failed:', err))
    fetchHealth().catch((err: unknown) => console.warn('[Init] health fetch failed:', err))
    fetchAlerts().catch((err: unknown) => console.warn('[Init] alerts fetch failed:', err))
  }, [])

  const isConnecting = connectionStatus === 'connecting' && !hasData
  const isDisconnected = connectionStatus === 'disconnected'

  return (
    <div className="flex flex-col h-full">
      <Header />

      {/* Disconnected banner — shows when WS drops after having been connected */}
      {isDisconnected && hasData && (
        <div className="flex items-center justify-center gap-2 bg-red-900/40 border-b border-red-700/50 py-1.5 text-xs text-red-300 flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          Backend disconnected — attempting to reconnect…
        </div>
      )}

      {/* Initial loading overlay — only before first data arrives */}
      {isConnecting ? (
        <div className="flex-1 flex items-center justify-center gap-3 text-slate-400 text-sm">
          <span className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" />
          Connecting to TransformerTwin backend…
        </div>
      ) : (
        <MainLayout />
      )}

      <BottomTimeline />
    </div>
  )
}
