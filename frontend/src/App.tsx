// Top-level layout: Header + MainLayout + BottomTimeline
// Initialises WebSocket connection on mount

import { useEffect } from 'react'
import { Header } from './components/layout/Header'
import { MainLayout } from './components/layout/MainLayout'
import { BottomTimeline } from './components/layout/BottomTimeline'
import { useWebSocket } from './hooks/useWebSocket'
import { fetchCurrentSensors, fetchAlerts, fetchHealth } from './hooks/useApi'

export default function App() {
  // Establish WebSocket connection (reconnects automatically)
  useWebSocket()

  // Fetch initial REST data on mount
  useEffect(() => {
    void fetchCurrentSensors()
    void fetchHealth()
    void fetchAlerts()
  }, [])

  return (
    <div className="flex flex-col h-full">
      <Header />
      <MainLayout />
      <BottomTimeline />
    </div>
  )
}
